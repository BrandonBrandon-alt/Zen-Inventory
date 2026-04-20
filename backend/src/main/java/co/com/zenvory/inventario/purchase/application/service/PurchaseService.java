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

/**
 * Servicio de aplicación que implementa la lógica de negocio para la gestión de compras.
 * 
 * <p>Coordina la interacción entre el dominio de compras, el control de inventarios, 
 * el catálogo de productos y el sistema de alertas. Orquestra transacciones complejas 
 * como la recepción de mercancía, donde se afecta simultáneamente el stock físico 
 * y se recalculan los costos promedio ponderados.</p>
 */
@Service
public class PurchaseService implements PurchaseUseCase {

    /** Puerto de persistencia para órdenes de compra. */
    private final PurchaseRepositoryPort repository;
    
    /** Puerto para actualizaciones de stock y movimientos de almacén. */
    private final InventoryUseCase inventoryUseCase;
    
    /** Puerto para consulta de información técnica de productos. */
    private final ProductUseCase productUseCase;
    
    /** Puerto para la gestión de notificaciones y umbrales de stock. */
    private final AlertUseCase alertUseCase;

    /**
     * Constructor con inyección de dependencias.
     * 
     * @param repository       Repositorio de órdenes.
     * @param inventoryUseCase Servicio de inventarios.
     * @param productUseCase   Servicio de catálogo.
     * @param alertUseCase     Servicio de alertas (con {@link Lazy} para evitar dependencias circulares).
     */
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

        return repository.save(order);
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
                // Capturar CPP anterior para auditoría de impacto
                Product productBefore = productUseCase.getProductById(detail.getProductId());
                BigDecimal oldCpp = productBefore.getAverageCost();

                // Actualizar stock e integrar con lógica de contabilidad de costos
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

                // Capturar el nuevo CPP recalculado por el módulo de inventario
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

            // Verificación simplificada de cumplimiento de línea
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
