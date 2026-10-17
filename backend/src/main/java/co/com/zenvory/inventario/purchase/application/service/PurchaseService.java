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
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Set;
import java.util.Map;

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
    

    /**
     * Constructor con inyección de dependencias.
     * 
     * @param repository       Repositorio de órdenes.
     * @param inventoryUseCase Servicio de inventarios.
     * @param productUseCase   Servicio de catálogo.
     */
    public PurchaseService(PurchaseRepositoryPort repository, 
                           InventoryUseCase inventoryUseCase,
                           ProductUseCase productUseCase) {
        this.repository = repository;
        this.inventoryUseCase = inventoryUseCase;
        this.productUseCase = productUseCase;
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

        // Se valida todo antes de mover stock: ni aprobada pendiente, ni líneas ajenas, ni sobrerrecepción.
        order.requireReceivable();
        requireValidReceipt(items);
        Set<Long> orderDetailIds = order.getDetails().stream().map(PurchaseOrderDetail::getId).collect(Collectors.toSet());
        if (!orderDetailIds.containsAll(items.keySet())) {
            throw new IllegalArgumentException("La recepción incluye líneas que no pertenecen a la orden.");
        }
        for (PurchaseOrderDetail detail : order.getDetails()) {
            BigDecimal incoming = items.getOrDefault(detail.getId(), new PurchaseUseCase.ItemReceiptInfo(BigDecimal.ZERO, null)).quantity();
            if (incoming.compareTo(detail.pendingQuantity()) > 0) {
                throw new IllegalArgumentException("No se puede recibir más de lo pendiente en el producto " + detail.getProductId() + ".");
            }
        }
        
        for (PurchaseOrderDetail detail : order.getDetails()) {
            PurchaseUseCase.ItemReceiptInfo receiptInfo = items.getOrDefault(detail.getId(), new PurchaseUseCase.ItemReceiptInfo(BigDecimal.ZERO, null));
            BigDecimal qtyNow = receiptInfo.quantity();
            
            if (qtyNow.compareTo(BigDecimal.ZERO) > 0) {
                detail.registerReceipt(qtyNow);
                // Capturar CPP anterior para auditoría de impacto
                Product productBefore = productUseCase.getProductById(detail.getProductId());
                BigDecimal oldCpp = productBefore.getAverageCost();

                // Actualizar stock e integrar con lógica de contabilidad de costos
                inventoryUseCase.addStock(
                        order.getBranchId(),
                        detail.getProductId(),
                        qtyNow,
                        null,
                        MovementReason.COMPRA,
                        userId,
                        order.getId(),
                        "ORDEN_COMPRA",
                        detail.effectiveUnitPrice(),
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
        }

        // El cumplimiento se mide sobre lo acumulado de todas las recepciones, no solo sobre esta entrega.
        boolean allMet = order.getDetails().stream().allMatch(PurchaseOrderDetail::isFullyReceived);
        order.receive(userId, allMet);
        PurchaseOrder savedOrder = repository.save(order);
        
        return new PurchaseReceiptResult(savedOrder, impacts);
    }

    /**
     * Una recepción tiene que traer algo: sin cantidades negativas, al menos una línea con cantidad y sin unidad
     * alterna (la cantidad pedida y recibida van en la unidad base; convertir cajas/paquetes aquí descuadraría el
     * estado de la orden, el stock y el costo).
     */
    private void requireValidReceipt(Map<Long, PurchaseUseCase.ItemReceiptInfo> items) {
        BigDecimal total = BigDecimal.ZERO;
        for (PurchaseUseCase.ItemReceiptInfo info : items.values()) {
            if (info.quantity() == null || info.quantity().signum() < 0) {
                throw new IllegalArgumentException("Las cantidades recibidas no pueden ser negativas.");
            }
            if (info.unitId() != null) {
                throw new IllegalArgumentException("La recepción de compras se registra en la unidad base del producto.");
            }
            total = total.add(info.quantity());
        }
        if (total.signum() == 0) {
            throw new IllegalArgumentException("Debe indicar al menos una cantidad recibida.");
        }
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

    @Override
    public List<PurchaseOrder> getOrdersByBranch(Long branchId) {
        return repository.findByBranchId(branchId);
    }
}
