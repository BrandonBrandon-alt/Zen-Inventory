package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;

/**
 * DTO (Data Transfer Object) que captura los términos comerciales específicos de un proveedor para un producto.
 * 
 * <p>Esta estructura se utiliza anidada dentro de la creación o edición de productos 
 * para definir la matriz de suministros y sus condiciones económicas y logísticas.</p>
 *
 * @param supplierId Identificador único del proveedor.
 * @param negotiatedPrice Costo de compra pactado fuera de lista.
 * @param deliveryDays Plazo de entrega garantizado por el proveedor.
 * @param preferred Marca para identificar la fuente de suministro primaria.
 */
public record ProductSupplierRequest(
    @NotNull(message = "El ID del proveedor es obligatorio")
    Long supplierId,

    @NotNull(message = "El precio negociado es obligatorio")
    @DecimalMin(value = "0.0", message = "El precio negociado no puede ser negativo")
    BigDecimal negotiatedPrice,

    @NotNull(message = "El tiempo de entrega es obligatorio")
    @Min(value = 0, message = "El tiempo de entrega no puede ser negativo")
    Integer deliveryDays,

    @NotNull(message = "Debe indicar si es el proveedor preferido")
    Boolean preferred
) {}

