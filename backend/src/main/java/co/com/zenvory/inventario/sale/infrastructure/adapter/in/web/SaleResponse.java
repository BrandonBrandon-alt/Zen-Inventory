package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.sale.domain.model.Sale;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record SaleResponse(
        Long id,
        LocalDateTime date,
        BigDecimal subtotal,
        BigDecimal totalDiscount,
        BigDecimal totalFinal,
        Long branchId,
        String branchName,
        Long userId,
        String userName,
        String status,
        String cancellationReason,
        String customerName,
        String customerDocument,
        BigDecimal globalDiscountPercentage,
        List<SaleDetailResponse> details
) {
    public record SaleDetailResponse(
            Long id,
            Long productId,
            String productName,
            Integer quantity,
            BigDecimal unitPriceApplied,
            BigDecimal discountPercentage,
            BigDecimal subtotalLine
    ) {}

    public static SaleResponse fromDomain(Sale sale) {
        return new SaleResponse(
                sale.getId(),
                sale.getDate(),
                sale.getSubtotal(),
                sale.getTotalDiscount(),
                sale.getTotalFinal(),
                sale.getBranchId(),
                sale.getBranchName(),
                sale.getUserId(),
                sale.getUserName(),
                sale.getStatus().name(),
                sale.getCancellationReason(),
                sale.getCustomerName(),
                sale.getCustomerDocument(),
                sale.getGlobalDiscountPercentage(),
                sale.getDetails().stream().map(d -> new SaleDetailResponse(
                        d.getId(),
                        d.getProductId(),
                        d.getProductName(),
                        d.getQuantity(),
                        d.getUnitPriceApplied(),
                        d.getDiscountPercentage(),
                        d.getSubtotalLine()
                )).toList()
        );
    }
}
