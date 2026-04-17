package co.com.zenvory.inventario.transfer.application.port.in;

import java.util.List;

public record ReceiveTransferCommand(
        Long userId,
        String notes,
        List<ReceivedDetail> items
) {
    public record ReceivedDetail(
            Long detailId,
            Integer receivedQuantity
    ) {}
}
