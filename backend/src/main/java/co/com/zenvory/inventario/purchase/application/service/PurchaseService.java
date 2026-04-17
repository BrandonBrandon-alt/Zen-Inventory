package co.com.zenvory.inventario.purchase.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.application.port.out.PurchaseRepositoryPort;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrderDetail;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class PurchaseService implements PurchaseUseCase {

    private final PurchaseRepositoryPort repository;
    private final InventoryUseCase inventoryUseCase;

    public PurchaseService(PurchaseRepositoryPort repository, InventoryUseCase inventoryUseCase) {
        this.repository = repository;
        this.inventoryUseCase = inventoryUseCase;
    }

    @Override
    @Transactional
    public PurchaseOrder createOrder(CreatePurchaseCommand command) {
        List<PurchaseOrderDetail> details = command.items().stream()
                .map(item -> PurchaseOrderDetail.create(item.productId(), item.quantity(), item.unitPrice(), item.discountPct()))
                .toList();

        PurchaseOrder order = PurchaseOrder.create(
                command.supplierId(),
                command.userId(),
                command.branchId(), 
                command.estimatedArrivalDate(),
                command.paymentDueDays(),
                details
        );

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
    public PurchaseOrder receiveOrder(Long orderId, Long userId) {
        PurchaseOrder order = getOrderById(orderId);
        
        // El dominio valida el estado y registra el usuario de recepción
        order.receive(userId);

        PurchaseOrder savedOrder = repository.save(order);

        // Orquestación: Al recibir, el stock debe aumentar físicamente en la sucursal de destino
        for (PurchaseOrderDetail detail : savedOrder.getDetails()) {
            inventoryUseCase.addStock(
                    savedOrder.getBranchId(),
                    detail.getProductId(),
                    detail.getQuantity(),
                    MovementReason.COMPRA,
                    userId,
                    savedOrder.getId(),
                    "ORDEN_COMPRA",
                    detail.getUnitPrice()
            );
        }

        return savedOrder;
    }

    @Override
    @Transactional
    public PurchaseOrder registerPayment(Long orderId) {
        PurchaseOrder order = getOrderById(orderId);
        order.registerPayment();
        return repository.save(order);
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
