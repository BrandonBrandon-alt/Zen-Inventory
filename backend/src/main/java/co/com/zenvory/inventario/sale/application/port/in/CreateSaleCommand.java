package co.com.zenvory.inventario.sale.application.port.in;

import java.util.List;

public record CreateSaleCommand(
        Long branchId,
        Long userId,
        String customerName,
        String customerDocument,
        co.com.zenvory.inventario.sale.domain.model.SalePaymentMethod paymentMethod,
        String paymentReference,
        java.math.BigDecimal globalDiscountPercentage,
        Long priceListId,
        List<Detail> items
) {
    public record Detail(
            Long productId,
            Integer quantity,
            java.math.BigDecimal discountPercentage,
            Long priceListId
    ) {}
}
