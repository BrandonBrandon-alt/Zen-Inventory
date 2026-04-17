package co.com.zenvory.inventario.alert.application.service;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.alert.application.port.out.AlertRepositoryPort;
import co.com.zenvory.inventario.alert.domain.model.ResolutionType;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class AlertService implements AlertUseCase {

    private final AlertRepositoryPort alertRepository;
    private final InventoryUseCase inventoryUseCase;
    private final ProductUseCase productUseCase;
    private final BranchUseCase branchUseCase;
    private final TransferUseCase transferUseCase;
    private final PurchaseUseCase purchaseUseCase;

    public AlertService(AlertRepositoryPort alertRepository, 
                        InventoryUseCase inventoryUseCase,
                        ProductUseCase productUseCase,
                        BranchUseCase branchUseCase,
                        TransferUseCase transferUseCase,
                        PurchaseUseCase purchaseUseCase) {
        this.alertRepository = alertRepository;
        this.inventoryUseCase = inventoryUseCase;
        this.productUseCase = productUseCase;
        this.branchUseCase = branchUseCase;
        this.transferUseCase = transferUseCase;
        this.purchaseUseCase = purchaseUseCase;
    }

    /**
     * Engine Manager. Se ejecuta en background automáticamente.
     * fixedDelay = 3600000ms = 1 Hora
     */
    @Override
    @Transactional
    @Scheduled(fixedDelayString = "3600000")
    public void scanForAlerts() {
        List<LocalInventory> lowStockInventories = inventoryUseCase.getLowStockInventories();
        for (LocalInventory inv : lowStockInventories) {
            handleLowStockCheck(inv);
        }
    }

    @Transactional
    public void handleLowStockCheck(LocalInventory inv) {
        if (inv.getCurrentQuantity().compareTo(inv.getMinimumStock()) <= 0 && inv.getMinimumStock().compareTo(java.math.BigDecimal.ZERO) > 0) {
            // Verificar si ya hay alerta activa para no causar spam.
            List<StockAlert> unresolves = alertRepository.findUnresolvedByBranchAndProduct(inv.getBranchId(),
                    inv.getProductId());
            if (unresolves.isEmpty()) {
                String actual = inv.getCurrentQuantity().stripTrailingZeros().toPlainString();
                String minimo = inv.getMinimumStock().stripTrailingZeros().toPlainString();
                
                // Obtener nombres para el mensaje descriptivo
                Product product = productUseCase.getProductById(inv.getProductId());
                Branch branch = branchUseCase.getBranchById(inv.getBranchId());
                String unidad = product.getUnitAbbreviation() != null ? product.getUnitAbbreviation() : "UND";

                String msg = String.format("⚠ Stock crítico en %s: %s tiene solo %s %s (Mínimo: %s)",
                        branch.getName(), product.getName(), actual, unidad, minimo);

                StockAlert alert = StockAlert.create(inv.getBranchId(), inv.getProductId(), msg);
                alertRepository.save(alert);
            }
        }
    }

    @Override
    @Transactional
    public void handleRestoredStockCheck(Long branchId, Long productId) {
        List<StockAlert> activeAlerts = alertRepository.findUnresolvedByBranchAndProduct(branchId, productId);
        for (StockAlert alert : activeAlerts) {
            alert.resolve(ResolutionType.DISMISSED, null, "Stock restaurado a niveles seguros automáticamente");
            alertRepository.save(alert);
        }
    }

    @Override
    @Transactional
    public void createAlert(Long branchId, Long productId, String message) {
        StockAlert alert = StockAlert.create(branchId, productId, message);
        alertRepository.save(alert);
    }

    @Override
    public List<StockAlert> getActiveAlerts(Long branchId) {
        return alertRepository.findActiveAlerts(branchId);
    }

    @Override
    public List<StockAlert> getGlobalActiveAlerts() {
        return alertRepository.getGlobalActiveAlerts();
    }

    @Override
    @Transactional
    public void resolveAlert(Long alertId) {
        StockAlert alert = findAlert(alertId);
        alert.resolve(ResolutionType.DISMISSED, null, "Resolución manual genérica");
        alertRepository.save(alert);
    }

    @Override
    @Transactional
    public void resolveViaTransfer(Long alertId, Long originBranchId, Integer quantity) {
        StockAlert alert = findAlert(alertId);
        
        RequestTransferCommand cmd = new RequestTransferCommand(
                originBranchId,
                alert.getBranchId(),
                LocalDateTime.now().plusDays(2), // +2 días sugerido por Tech Lead
                List.of(new RequestTransferCommand.Detail(alert.getProductId(), quantity))
        );
        
        var transfer = transferUseCase.requestTransfer(cmd);
        
        alert.resolve(ResolutionType.TRANSFER, transfer.getId(), "Abastecimiento vía transferencia interna");
        alertRepository.save(alert);
    }

    @Override
    @Transactional
    public void resolveViaPurchaseOrder(Long alertId, LocalDateTime estimatedArrival, BigDecimal quantity) {
        StockAlert alert = findAlert(alertId);
        Product product = productUseCase.getProductById(alert.getProductId());
        
        if (product.getSupplierId() == null) {
            throw new IllegalStateException("El producto no tiene un proveedor asociado para generar una orden de compra.");
        }

        CreatePurchaseCommand cmd = new CreatePurchaseCommand(
                product.getSupplierId(),
                1L, // Por ahora default ADMIN ID = 1
                alert.getBranchId(),
                estimatedArrival,
                30,
                List.of(new CreatePurchaseCommand.Detail(
                        alert.getProductId(), 
                        quantity,
                        product.getAverageCost(),
                        BigDecimal.ZERO
                ))
        );
        
        var order = purchaseUseCase.createOrder(cmd);
        
        alert.resolve(ResolutionType.PURCHASE, order.getId(), "Abastecimiento vía orden de compra");
        alertRepository.save(alert);
    }

    @Override
    @Transactional
    public void dismissAlert(Long alertId, String reason) {
        StockAlert alert = findAlert(alertId);
        alert.resolve(ResolutionType.DISMISSED, null, reason);
        alertRepository.save(alert);
    }

    private StockAlert findAlert(Long id) {
        return alertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("No se encontró la alerta de stock solicitada."));
    }
}
