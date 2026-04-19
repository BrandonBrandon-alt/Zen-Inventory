package co.com.zenvory.inventario.transfer.application.port.in;

import java.util.List;

public record DispatchTransferCommand(
        String carrier,
        java.math.BigDecimal shippingCost,
        String trackingNumber,
        java.time.LocalDateTime estimatedArrivalDate,
        List<DispatchDetail> items
) {
    public record DispatchDetail(
            Long detailId,
            Integer sentQuantity
    ) {}
}
