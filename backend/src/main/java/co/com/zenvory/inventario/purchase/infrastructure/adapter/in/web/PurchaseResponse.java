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
        Integer deliveryLeadTimeDays,
        BigDecimal total,
        String reasonResolution,
        boolean exceptionApproved,
        /** Lo ya pagado al proveedor (suma de los pagos). */
        BigDecimal paidAmount,
        /** Lo que aún se debe; cero si está pagada o cancelada. */
        BigDecimal balance,
        /** Queda saldo y ya pasó la fecha de vencimiento. */
        boolean overdue,
        List<PaymentResponse> payments,
        List<PurchaseDetailResponse> details
) {
    public record PaymentResponse(
            Long id,
            BigDecimal amount,
            LocalDateTime date,
            Long userId,
            String userName,
            String method,
            String reference,
            String notes
    ) {}

    public record PurchaseDetailResponse(
            Long id,
            Long productId,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal discountPct,
            BigDecimal subtotal,
            /** Lo ya recibido de esta línea (en recepciones parciales); lo pendiente es {@code quantity - receivedQuantity}. */
            BigDecimal receivedQuantity
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
                order.getDeliveryLeadTimeDays(),
                order.getTotal(),
                order.getReasonResolution(),
                order.isExceptionApproved(),
                order.paidAmount(),
                order.balance(),
                order.isOverdue(LocalDateTime.now()),
                order.getPayments().stream().map(p -> new PaymentResponse(p.getId(), p.getAmount(), p.getDate(),
                        p.getUserId(), p.getUserName(), p.getMethod().name(), p.getReference(), p.getNotes())).toList(),
                order.getDetails().stream().map(d -> new PurchaseDetailResponse(
                        d.getId(),
                        d.getProductId(),
                        d.getQuantity(),
                        d.getUnitPrice(),
                        d.getDiscountPct(),
                        d.computeSubtotal(),
                        d.getReceivedQuantity()
                )).toList()
        );
    }
}
