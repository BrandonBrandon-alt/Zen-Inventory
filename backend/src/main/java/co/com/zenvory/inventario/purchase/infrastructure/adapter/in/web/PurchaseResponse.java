package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseResponse(
        Long id,
        String receptionStatus,
        String paymentStatus,
        LocalDateTime requestDate,
        LocalDateTime estimatedArrivalDate,
        LocalDateTime actualArrivalDate,
        Integer paymentDueDays,
        LocalDateTime paymentDueDate,
        Long supplierId,
        Long userId,
        Long receivingUserId,
        Long branchId,
        BigDecimal total,
        List<PurchaseDetailResponse> details
) {
    public record PurchaseDetailResponse(
            Long id,
            Long productId,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal discountPct,
            BigDecimal subtotal
    ) {}

    public static PurchaseResponse fromDomain(PurchaseOrder order) {
        return new PurchaseResponse(
                order.getId(),
                order.getReceptionStatus().name(),
                order.getPaymentStatus().name(),
                order.getRequestDate(),
                order.getEstimatedArrivalDate(),
                order.getActualArrivalDate(),
                order.getPaymentDueDays(),
                order.getPaymentDueDate(),
                order.getSupplierId(),
                order.getUserId(),
                order.getReceivingUserId(),
                order.getBranchId(),
                order.getTotal(),
                order.getDetails().stream().map(d -> new PurchaseDetailResponse(
                        d.getId(),
                        d.getProductId(),
                        d.getQuantity(),
                        d.getUnitPrice(),
                        d.getDiscountPct(),
                        d.computeSubtotal()
                )).toList()
        );
    }
}
