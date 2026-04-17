package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.FutureOrPresent;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public record PurchaseRequest(
        @NotNull(message = "El proveedor es obligatorio.")
        Long supplierId,

        @NotNull(message = "El usuario tramitador es obligatorio.")
        Long userId,

        @NotNull(message = "La sucursal destino es obligatoria.")
        Long branchId,

        @FutureOrPresent(message = "La fecha estimada de llegada debe ser futura.")
        LocalDateTime estimatedArrivalDate,
        
        @NotNull(message = "El plazo de pago es obligatorio.")
        Integer paymentDueDays,

        @NotEmpty(message = "La orden de compra no puede estar vacía.")
        @Valid
        List<PurchaseDetailRequest> items
) {
    public record PurchaseDetailRequest(
            @NotNull(message = "El producto es obligatorio.")
            Long productId,

            @NotNull(message = "La cantidad es obligatoria.")
            @Positive(message = "La cantidad comprada debe ser mayor a cero.")
            BigDecimal quantity,

            @NotNull(message = "El precio de compra unitario es obligatorio.")
            @Positive(message = "El precio de compra debe ser mayor a cero.")
            BigDecimal unitPrice,

            BigDecimal discountPct
    ) {}
}
