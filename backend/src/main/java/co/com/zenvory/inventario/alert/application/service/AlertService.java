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
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.annotation.Propagation;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicación que implementa la lógica de gestión de alertas de stock.
 * 
 * <p>Responsabilidades principales:
 * <ul>
 *     <li>Monitoreo de niveles de inventario (proactivo y reactivo).</li>
 *     <li>Creación de alertas de bajo stock y quiebres.</li>
 *     <li>Gestión de la resolución de alertas mediante traslados o compras.</li>
 *     <li>Sincronización de alertas según eventos del sistema.</li>
 * </ul>
 * </p>
 * 
 * <p>Contexto: Este servicio actúa como el director de orquesta para resolver problemas de 
 * disponibilidad de productos, interactuando con los módulos de Inventario, Compras y Traslados.</p>
 */
@Service
public class AlertService implements AlertUseCase {

    private final AlertRepositoryPort alertRepository;
    private final InventoryUseCase inventoryUseCase;
    private final ProductUseCase productUseCase;
    private final BranchUseCase branchUseCase;
    private final TransferUseCase transferUseCase;
    private final PurchaseUseCase purchaseUseCase;
    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    /**
     * Constructor único para inyección de dependencias.
     * 
     * @param alertRepository Adaptador de persistencia para alertas.
     * @param inventoryUseCase Caso de uso para consulta de stock.
     * @param productUseCase Caso de uso para obtener metadatos de productos.
     * @param branchUseCase Caso de uso para obtener información de sucursales.
     * @param transferUseCase Caso de uso para generar traslados internos.
     * @param purchaseUseCase Caso de uso para generar órdenes de compra.
     */
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
     * Motor de escaneo automático. Se ejecuta periódicamente en segundo plano.
     * 
     * <p>Configuración:
     * - interval: 5 minutos (300,000ms)
     * - initialDelay: 30 segundos
     * </p>
     */
    @Override
    @Transactional
    @Scheduled(fixedDelayString = "300000", initialDelayString = "30000")
    public void scanForAlerts() {
        log.debug("Iniciando escaneo programado de alertas de bajo stock...");
        List<LocalInventory> lowStockInventories = inventoryUseCase.getLowStockInventories();
        for (LocalInventory inv : lowStockInventories) {
            handleLowStockCheck(inv);
        }
    }

    /**
     * Reacciona de forma asíncrona cuando un evento indica que el stock ha bajado.
     * Se ejecuta después del commit de la transacción que originó la baja.
     * 
     * @param event Evento con los datos del producto y sucursal afectados.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onStockLevelDropped(StockLevelDroppedEvent event) {
        try {
            log.info("Iniciando procesamiento de alerta de stock bajo... [TX_EVENT]");
            LocalInventory inv = inventoryUseCase.getInventory(event.getBranchId(), event.getProductId());
            handleLowStockCheck(inv);
        } catch (Exception e) {
            log.error("Error crítico procesando alerta de stock bajo para producto {} en sucursal {}: {}", 
                    event.getProductId(), event.getBranchId(), e.getMessage());
        }
    }

    /**
     * Reacciona de forma asíncrona cuando un evento indica que el stock se ha restaurado.
     * Permite limpiar o resolver alertas automáticas que ya no son necesarias.
     * 
     * @param event Evento de restauración de niveles.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onStockLevelRestored(StockLevelRestoredEvent event) {
        try {
            log.info("Iniciando verificación de restauración de stock... [TX_EVENT]");
            handleRestoredStockCheck(event.getBranchId(), event.getProductId());
        } catch (Exception e) {
            log.error("Error crítico procesando restauración de stock para producto {} en sucursal {}: {}", 
                    event.getProductId(), event.getBranchId(), e.getMessage());
        }
    }

    /**
     * Lógica central para determinar si se debe crear una nueva alerta por bajo stock.
     * Implementa validaciones para evitar duplicación de alertas (spam).
     * 
     * @param inv Estado actual del inventario local a evaluar.
     */
    @Transactional
    public void handleLowStockCheck(LocalInventory inv) {
        // Condición: stock actual <= stock mínimo y el mínimo está definido (>0)
        if (inv.getCurrentQuantity().compareTo(inv.getMinimumStock()) <= 0 && inv.getMinimumStock().compareTo(java.math.BigDecimal.ZERO) > 0) {
            
            // Verificación de redundancia: si ya hay una alerta activa para este producto/sucursal, no creamos otra.
            List<StockAlert> unresolves = alertRepository.findUnresolvedByBranchAndProduct(inv.getBranchId(),
                    inv.getProductId());
            
            if (unresolves.isEmpty()) {
                String actual = inv.getCurrentQuantity().stripTrailingZeros().toPlainString();
                String minimo = inv.getMinimumStock().stripTrailingZeros().toPlainString();
                
                // Enriquecimiento de datos para el mensaje descriptivo
                Product product = productUseCase.getProductById(inv.getProductId());
                Branch branch = branchUseCase.getBranchById(inv.getBranchId());
                String unidad = product.getUnitAbbreviation() != null ? product.getUnitAbbreviation() : "UND";

                String msg = String.format("⚠ Stock crítico en %s: %s tiene solo %s %s (Mínimo: %s)",
                        branch.getName(), product.getName(), actual, unidad, minimo);

                StockAlert alert = StockAlert.create(inv.getBranchId(), inv.getProductId(), msg);
                alertRepository.save(alert);
                log.info("Nueva alerta generada: {}", msg);
            }
        }
    }

    /**
     * Resuelve automáticamente alertas activas cuando el stock vuelve a niveles normales.
     * 
     * @param branchId Sucursal.
     * @param productId Producto.
     */
    @Override
    @Transactional
    public void handleRestoredStockCheck(Long branchId, Long productId) {
        List<StockAlert> activeAlerts = alertRepository.findUnresolvedByBranchAndProduct(branchId, productId);
        for (StockAlert alert : activeAlerts) {
            alert.resolve(ResolutionType.DISMISSED, null, "Stock restaurado a niveles seguros automáticamente");
            alertRepository.save(alert);
            log.info("Alerta resuelta automáticamente por restauración de stock. ID: {}", alert.getId());
        }
    }

    /**
     * Crea una alerta de tipo estándar (INFO).
     */
    @Override
    @Transactional
    public void createAlert(Long branchId, Long productId, String message) {
        StockAlert alert = StockAlert.create(branchId, productId, message);
        alertRepository.save(alert);
    }

    /**
     * Crea una alerta con tipificación y referencia externa específica.
     */
    @Override
    @Transactional
    public void createAlert(Long branchId, Long productId, String message, StockAlert.AlertType type, Long referenceId) {
        StockAlert alert = StockAlert.create(branchId, productId, message, type, referenceId);
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

    /**
     * Resuelve una alerta sin realizar acciones adicionales en el sistema.
     */
    @Override
    @Transactional
    public void resolveAlert(Long alertId) {
        StockAlert alert = findAlert(alertId);
        alert.resolve(ResolutionType.DISMISSED, null, "Resolución manual genérica");
        alertRepository.save(alert);
    }

    /**
     * Orquestación de resolución vía traslado interno.
     * Delega la creación de la solicitud al módulo de Transferencias.
     */
    @Override
    @Transactional
    public void resolveViaTransfer(Long alertId, Long originBranchId, Integer quantity, Long userId, String priority) {
        StockAlert alert = findAlert(alertId);
        
        // Mapeo manual de prioridad de texto a ENUM del dominio de transferencias
        RequestTransferCommand cmd = new RequestTransferCommand(
                originBranchId,
                alert.getBranchId(),
                LocalDateTime.now().plusDays(2),
                priority != null ? co.com.zenvory.inventario.transfer.domain.model.TransferPriority.valueOf(priority.toUpperCase()) : co.com.zenvory.inventario.transfer.domain.model.TransferPriority.HIGH,
                List.of(new RequestTransferCommand.Detail(alert.getProductId(), quantity))
        );
        
        var transfer = transferUseCase.requestTransfer(cmd);
        
        // Vinculación de la alerta con el documento de traslado generado
        alert.resolve(ResolutionType.TRANSFER, transfer.getId(), "Abastecimiento vía transferencia interna");
        alertRepository.save(alert);
        log.info("Alerta {} resuelta mediante Traslado {}", alertId, transfer.getId());
    }

    /**
     * Orquestación de resolución vía compra externa.
     * Delega la creación del borrador de orden al módulo de Compras.
     */
    @Override
    @Transactional
    public void resolveViaPurchaseOrder(Long alertId, Integer leadTimeDays, BigDecimal quantity, Long userId, boolean isManager, Long supplierId) {
        StockAlert alert = findAlert(alertId);
        Product product = productUseCase.getProductById(alert.getProductId());
        
        // Creación del comando de compra basado en los datos de la alerta y el producto
        CreatePurchaseCommand cmd = new CreatePurchaseCommand(
                supplierId,
                userId != null ? userId : 1L,
                alert.getBranchId(),
                leadTimeDays,
                30,
                List.of(new CreatePurchaseCommand.Detail(
                        alert.getProductId(), 
                        quantity,
                        product.getAverageCost(),
                        BigDecimal.ZERO
                ))
        );
        
        var order = purchaseUseCase.createOrder(cmd, isManager);
        
        // Vinculación de la alerta con la orden de compra generada
        alert.resolve(ResolutionType.PURCHASE, order.getId(), "Abastecimiento vía orden de compra");
        alertRepository.save(alert);
        log.info("Alerta {} resuelta mediante Orden de Compra {}", alertId, order.getId());
    }

    @Override
    @Transactional
    public void dismissAlert(Long alertId, String reason) {
        StockAlert alert = findAlert(alertId);
        alert.resolve(ResolutionType.DISMISSED, null, reason);
        alertRepository.save(alert);
    }

    /**
     * Método auxiliar de búsqueda con validación de existencia.
     */
    private StockAlert findAlert(Long id) {
        return alertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("No se encontró la alerta de stock solicitada."));
    }
}
