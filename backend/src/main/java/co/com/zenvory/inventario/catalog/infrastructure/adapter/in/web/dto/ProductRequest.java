package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;
import java.math.BigDecimal;

/**
 * DTO de entrada para crear o actualizar un producto en el catálogo.
 *
 * <p>Las validaciones se aplican aquí (capa de infraestructura web) porque
 * son reglas del protocolo HTTP, no invariantes de negocio del dominio.
 * El controlador activa estas validaciones con {@code @Valid}.</p>
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
        @DecimalMin(value = "0.0", inclusive = false, message = "El costo promedio debe ser mayor a 0")
        @Digits(integer = 10, fraction = 2, message = "El costo promedio debe tener máximo 10 enteros y 2 decimales")
        BigDecimal costoPromedio,

        @NotNull(message = "El precio de venta es obligatorio")
        @DecimalMin(value = "0.0", inclusive = false, message = "El precio de venta debe ser mayor a 0")
        @Digits(integer = 10, fraction = 2, message = "El precio de venta debe tener máximo 10 enteros y 2 decimales")
        BigDecimal precioVenta,

        Long proveedorId,
        Long unitId

) {}
