package co.com.zenvory.inventario.purchase.application.port.in;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record CreatePurchaseCommand(
        Long supplierId,
        Long userId,
        Long branchId,
        LocalDateTime estimatedArrivalDate,
        Integer paymentDueDays,
        List<Detail> items
) {
    public record Detail(
            Long productId,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal discountPct
    ) {}
}
