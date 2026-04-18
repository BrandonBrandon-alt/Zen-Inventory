package co.com.zenvory.inventario.purchase.application.port.in;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;

import java.util.List;

public interface PurchaseUseCase {
    PurchaseOrder createOrder(CreatePurchaseCommand command);
    PurchaseOrder markAsInTransit(Long orderId);

    PurchaseReceiptResult receiveOrder(Long orderId, Long userId, java.util.Map<Long, ItemReceiptInfo> items);

    record ItemReceiptInfo(java.math.BigDecimal quantity, Long unitId) {}

    PurchaseOrder closeShortfall(Long orderId, Long userId);

    PurchaseOrder registerPayment(Long orderId);
    void cancelPurchase(Long orderId, String reason, Long userId);
    PurchaseOrder getOrderById(Long orderId);
    List<PurchaseOrder> getAllOrders();
}
