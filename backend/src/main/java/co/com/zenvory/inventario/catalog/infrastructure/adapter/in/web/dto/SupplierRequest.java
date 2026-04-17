package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;

/**
 * DTO de entrada para crear o actualizar un proveedor.
 */
public record SupplierRequest(

        @NotBlank(message = "El nombre del proveedor es obligatorio")
        @Size(max = 150, message = "El nombre no puede superar los 150 caracteres")
        String nombre,

        @Size(max = 150, message = "El contacto no puede superar los 150 caracteres")
        String contacto,

        @Min(value = 0, message = "Los días de entrega no pueden ser negativos")
        Integer tiempoEntregaDias

) {}
