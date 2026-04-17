package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import java.util.List;

public record TransferReceiveRequest(
        @NotNull(message = "El ID de usuario es obligatorio para la auditoría.")
        Long userId,

        String notes,

        @NotEmpty(message = "Debe reportar al menos un detalle de la carga recibida.")
        @Valid
        List<ReceivedItemRequest> items
) {
    public record ReceivedItemRequest(
            @NotNull(message = "El ID del detalle de la transferencia es obligatorio.")
            Long detailId,

            @NotNull(message = "La cantidad recibida es obligatoria.")
            @PositiveOrZero(message = "La cantidad recibida puede ser cero, pero no negativa.")
            Integer receivedQuantity
    ) {}
}
