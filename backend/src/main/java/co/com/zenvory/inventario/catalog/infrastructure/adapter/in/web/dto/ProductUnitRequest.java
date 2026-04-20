package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/**
 * DTO (Data Transfer Object) de entrada para la vinculación técnica de unidades a productos.
 * 
 * <p>Se utiliza para configurar el factor de conversión de pesaje o empaque para un 
 * artículo específico, permitiendo transacciones en múltiples presentaciones.</p>
 *
 * @param productoId Identificador único del producto.
 * @param unidadId Identificador único de la unidad de medida.
 * @param factorConversion Relación numérica respecto a la unidad base.
 * @param esBase Indica si esta configuración define la unidad maestra de inventario.
 */
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

