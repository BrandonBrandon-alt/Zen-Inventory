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

        /** Se ignora: el tramitador es el usuario de la sesión. Se mantiene por compatibilidad con clientes antiguos. */
        Long userId,

        /** Sucursal destino; quien no es ADMIN siempre opera en la suya. */
        Long branchId,

        @NotNull(message = "El tiempo de entrega es obligatorio.")
        @Positive(message = "El tiempo de entrega debe ser positivo.")
        Integer leadTimeDays,
        
        @NotNull(message = "El plazo de pago es obligatorio.")
        @jakarta.validation.constraints.Min(value = 0, message = "El plazo de pago no puede ser negativo.")
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

            @jakarta.validation.constraints.DecimalMin(value = "0", message = "El descuento no puede ser negativo.")
            @jakarta.validation.constraints.DecimalMax(value = "100", message = "El descuento no puede superar el 100%.")
            BigDecimal discountPct
    ) {}
}
