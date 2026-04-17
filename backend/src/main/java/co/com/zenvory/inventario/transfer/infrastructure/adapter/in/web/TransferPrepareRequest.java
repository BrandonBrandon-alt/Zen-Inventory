package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import jakarta.validation.constraints.NotEmpty;
import java.util.List;

public record TransferPrepareRequest(
        @NotEmpty List<PrepareDetail> items
) {
    public record PrepareDetail(
            Long productId,
            Integer requestedQuantity
    ) {}
}
