package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import java.math.BigDecimal;
import java.util.List;

public record PurchaseReceiptResponse(
    Long orderId,
    String status,
    List<CppImpact> impacts
) {
    public record CppImpact(
        Long productId,
        String productName,
        BigDecimal oldCpp,
        BigDecimal newCpp,
        BigDecimal quantityReceived
    ) {}
}
