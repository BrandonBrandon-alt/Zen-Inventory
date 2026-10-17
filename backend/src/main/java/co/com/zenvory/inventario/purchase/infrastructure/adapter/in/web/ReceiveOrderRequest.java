package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.util.List;

public record ReceiveOrderRequest(
    /** Se ignora: quien recibe es el usuario de la sesión. */
    Long userId,
    @NotNull List<ItemReceipt> items
) {
    public record ItemReceipt(
        @NotNull Long detailId,
        @NotNull BigDecimal quantityReceived,
        Long unitId
    ) {}
}
