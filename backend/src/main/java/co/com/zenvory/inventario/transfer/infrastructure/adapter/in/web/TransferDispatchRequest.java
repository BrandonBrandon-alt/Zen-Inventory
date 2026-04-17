package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.List;

public record TransferDispatchRequest(
        @NotNull(message = "El ID de usuario es obligatorio.")
        Long userId,

        @NotNull(message = "El nombre del transportista es obligatorio.")
        String carrier,

        @NotEmpty(message = "Debe enviar al menos un item.")
        @Valid
        List<DispatchItemRequest> items
) {
    public record DispatchItemRequest(
            @NotNull(message = "El ID del detalle es obligatorio.")
            Long detailId,

            @NotNull(message = "La cantidad enviada es obligatoria.")
            @PositiveOrZero(message = "La cantidad enviada no puede ser negativa.")
            Integer sentQuantity
    ) {}
}
