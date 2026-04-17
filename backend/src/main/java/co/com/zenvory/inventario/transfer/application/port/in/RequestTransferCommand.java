package co.com.zenvory.inventario.transfer.application.port.in;

import java.time.LocalDateTime;
import java.util.List;

public record RequestTransferCommand(
        Long originBranchId,
        Long destinationBranchId,
        LocalDateTime estimatedArrivalDate,
        List<Detail> items
) {
    public record Detail(
            Long productId,
            Integer requestedQuantity
    ) {}
}
