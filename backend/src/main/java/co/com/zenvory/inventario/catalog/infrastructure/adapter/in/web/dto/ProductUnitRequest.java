package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/** DTO de entrada para asignar una unidad de medida a un producto. */
public record ProductUnitRequest(

        @NotNull(message = "El ID del producto es obligatorio")
        Long productoId,

        @NotNull(message = "El ID de la unidad es obligatorio")
        Long unidadId,

        @NotNull(message = "El factor de conversión es obligatorio")
        @DecimalMin(value = "0.0001", message = "El factor de conversión debe ser mayor a 0")
        @Digits(integer = 6, fraction = 4, message = "El factor debe tener máximo 6 enteros y 4 decimales")
        BigDecimal factorConversion,

        @NotNull(message = "Debe indicar si es la unidad base")
        Boolean esBase

) {}
