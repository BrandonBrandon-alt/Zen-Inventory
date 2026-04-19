package co.com.zenvory.inventario.transfer.application.port.in;

import java.time.LocalDateTime;
import java.util.List;

public record RequestTransferCommand(
        Long originBranchId,
        Long destinationBranchId,
        LocalDateTime estimatedArrivalDate,
        co.com.zenvory.inventario.transfer.domain.model.TransferPriority priority,
        List<Detail> items
) {
    public record Detail(
            Long productId,
            Integer requestedQuantity
    ) {}
}
