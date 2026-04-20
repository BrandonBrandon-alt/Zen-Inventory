package co.com.zenvory.inventario.purchase.application.service;

import co.com.zenvory.inventario.purchase.application.port.in.PurchaseReceiptResult;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.application.port.out.PurchaseRepositoryPort;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrderDetail;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class PurchaseService implements PurchaseUseCase {

    private final PurchaseRepositoryPort repository;
    private final InventoryUseCase inventoryUseCase;
    private final ProductUseCase productUseCase;
    private final AlertUseCase alertUseCase;

    public PurchaseService(PurchaseRepositoryPort repository, 
                           InventoryUseCase inventoryUseCase,
                           ProductUseCase productUseCase,
                           @Lazy AlertUseCase alertUseCase) {
        this.repository = repository;
        this.inventoryUseCase = inventoryUseCase;
        this.productUseCase = productUseCase;
        this.alertUseCase = alertUseCase;
    }

    @Override
    @Transactional
    public PurchaseOrder createOrder(CreatePurchaseCommand command, boolean isManager) {
        List<PurchaseOrderDetail> details = command.items().stream()
                .map(item -> PurchaseOrderDetail.create(item.productId(), item.quantity(), item.unitPrice(), item.discountPct()))
                .toList();

        PurchaseOrder order = PurchaseOrder.create(
                command.supplierId(),
                command.userId(),
                command.branchId(), 
                command.leadTimeDays(),
                command.paymentDueDays(),
                details,
                isManager
        );

        PurchaseOrder savedOrder = repository.save(order);


        return savedOrder;
    }

    @Override
    @Transactional
    public PurchaseOrder approveOrder(Long orderId, Long userId) {
        PurchaseOrder order = getOrderById(orderId);
        order.approve(userId);
        return repository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder approveException(Long orderId, Long userId) {
        PurchaseOrder order = getOrderById(orderId);
        order.approveException(userId);
        return repository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder markAsInTransit(Long orderId) {
        PurchaseOrder order = getOrderById(orderId);
        order.markAsInTransit();
        return repository.save(order);
    }

    @Override
    @Transactional
    public PurchaseReceiptResult receiveOrder(Long orderId, Long userId, Map<Long, PurchaseUseCase.ItemReceiptInfo> items) {
        PurchaseOrder order = getOrderById(orderId);
        List<PurchaseReceiptResult.CppImpact> impacts = new ArrayList<>();
        
        boolean allMet = true;
        for (PurchaseOrderDetail detail : order.getDetails()) {
            PurchaseUseCase.ItemReceiptInfo receiptInfo = items.getOrDefault(detail.getId(), new PurchaseUseCase.ItemReceiptInfo(BigDecimal.ZERO, null));
            BigDecimal qtyNow = receiptInfo.quantity();
            
            if (qtyNow.compareTo(BigDecimal.ZERO) > 0) {
                // Capturar CPP anterior
                Product productBefore = productUseCase.getProductById(detail.getProductId());
                BigDecimal oldCpp = productBefore.getAverageCost();

                // Actualizar stock
                inventoryUseCase.addStock(
                        order.getBranchId(),
                        detail.getProductId(),
                        qtyNow,
                        receiptInfo.unitId(),
                        MovementReason.COMPRA,
                        userId,
                        order.getId(),
                        "ORDEN_COMPRA",
                        detail.getUnitPrice(),
                        null,
                        null
                );

                // Capturar CPP nuevo
                Product productAfter = productUseCase.getProductById(detail.getProductId());
                BigDecimal newCpp = productAfter.getAverageCost();

                impacts.add(new PurchaseReceiptResult.CppImpact(
                        detail.getProductId(),
                        productAfter.getName(),
                        oldCpp,
                        newCpp,
                        qtyNow
                ));
            }

            // Validar si con lo recibido ahora se completa la línea (MVP simplificado)
            if (qtyNow.compareTo(detail.getQuantity()) < 0) {
                allMet = false;
            }
        }

        order.receive(userId, allMet);
        PurchaseOrder savedOrder = repository.save(order);
        
        return new PurchaseReceiptResult(savedOrder, impacts);
    }

    @Override
    @Transactional
    public PurchaseOrder closeShortfall(Long orderId, Long userId) {
        PurchaseOrder order = getOrderById(orderId);
        order.closeShortfall(userId);
        return repository.save(order);
    }

    @Override
    @Transactional
    public PurchaseOrder registerPayment(Long orderId) {
        PurchaseOrder order = getOrderById(orderId);
        order.registerPayment();
        return repository.save(order);
    }

    @Override
    @Transactional
    public void cancelPurchase(Long orderId, String reason, Long userId) {
        PurchaseOrder order = getOrderById(orderId);
        order.cancel(reason, userId);
        repository.save(order);
        
        // TODO: Notificar anulación a módulo CXP (Cuentas por Pagar). 
        // En este MVP lo manejaremos con este placeholder.
    }

    @Override
    public PurchaseOrder getOrderById(Long orderId) {
        return repository.findById(orderId)
                .orElseThrow(() -> new IllegalArgumentException("Orden de compra no encontrada: " + orderId));
    }

    @Override
    public List<PurchaseOrder> getAllOrders() {
        return repository.findAll();
    }
}
