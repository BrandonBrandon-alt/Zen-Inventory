package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import java.time.LocalDateTime;
import java.util.List;

public record TransferRequest(
        @NotNull(message = "El ID de la sucursal de origen es obligatorio.")
        Long originBranchId,

        @NotNull(message = "El ID de la sucursal de destino es obligatorio.")
        Long destinationBranchId,

        @FutureOrPresent(message = "La fecha estimada debe ser actual o futura.")
        LocalDateTime estimatedArrivalDate,

        @NotNull(message = "La prioridad de envío es obligatoria.")
        @Pattern(regexp = "NORMAL|HIGH|LOW", message = "La prioridad debe ser NORMAL, HIGH o LOW")
        String priority,

        @NotEmpty(message = "La transferencia debe contener al menos un producto a mover.")
        @Valid
        List<TransferDetailRequest> items
) {
    public record TransferDetailRequest(
            @NotNull(message = "El ID del producto es obligatorio.")
            Long productId,

            @NotNull(message = "La cantidad es obligatoria.")
            @Positive(message = "La cantidad debe ser mayor a cero.")
            Integer requestedQuantity
    ) {}
}
