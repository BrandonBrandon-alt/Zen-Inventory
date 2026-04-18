package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record ReceiveOrderRequest(
    @NotNull Long userId,
    @NotNull List<ItemReceipt> items
) {
    public record ItemReceipt(
        @NotNull Long detailId,
        @NotNull BigDecimal quantityReceived,
        Long unitId
    ) {}
}
