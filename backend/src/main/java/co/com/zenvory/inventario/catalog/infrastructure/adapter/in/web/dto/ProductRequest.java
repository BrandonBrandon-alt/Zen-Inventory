package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/**
 * DTO (Data Transfer Object) de entrada para la creación o actualización de productos.
 * 
 * <p>Define la estructura de datos que el cliente debe enviar en las peticiones HTTP.
 * Incluye metadatos de validación de Bean Validation para asegurar la integridad sintáctica 
 * de los datos antes de alcanzar la capa de aplicación.</p>
 *
 * @param sku Código único de identificación logística.
 * @param nombre Nombre descriptivo del producto.
 * @param costoPromedio Valor ponderado de adquisición.
 * @param precioVenta Valor sugerido para el mercado.
 * @param unitId Referencia a la unidad de medida principal.
 * @param suppliers Colección de proveedores y condiciones comerciales vinculadas.
 * @param activo Estado de disponibilidad del producto.
 */
public record ProductRequest(

        @NotBlank(message = "El SKU es obligatorio")
        @Size(max = 50, message = "El SKU no puede superar los 50 caracteres")
        @Pattern(regexp = "^[A-Z0-9\\-]+$", message = "El SKU solo puede contener letras mayúsculas, números y guiones")
        String sku,

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 150, message = "El nombre no puede superar los 150 caracteres")
        String nombre,

        @NotNull(message = "El costo promedio es obligatorio")
        @DecimalMin(value = "0.0", inclusive = true, message = "El costo promedio no puede ser negativo")
        @Digits(integer = 10, fraction = 2, message = "El costo promedio debe tener máximo 10 enteros y 2 decimales")
        BigDecimal costoPromedio,

        @NotNull(message = "El precio de venta es obligatorio")
        @DecimalMin(value = "0.0", inclusive = true, message = "El precio de venta no puede ser negativo")
        @Digits(integer = 10, fraction = 2, message = "El precio de venta debe tener máximo 10 enteros y 2 decimales")
        BigDecimal precioVenta,

        Long unitId,
        java.util.List<@jakarta.validation.Valid ProductSupplierRequest> suppliers,
        Boolean activo

) {}

