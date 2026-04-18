package co.com.zenvory.inventario.purchase.application.port.in;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import java.math.BigDecimal;
import java.util.List;

public record PurchaseReceiptResult(
    PurchaseOrder order,
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
