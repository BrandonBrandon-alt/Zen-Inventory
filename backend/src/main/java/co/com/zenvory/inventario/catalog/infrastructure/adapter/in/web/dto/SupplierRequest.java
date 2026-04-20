package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.*;

/**
 * DTO (Data Transfer Object) de entrada para la creación o actualización de proveedores.
 * 
 * <p>Define los parámetros necesarios para dar de alta o modificar un proveedor 
 * en el sistema, asegurando que los datos cumplan con las restricciones de 
 * longitud y obligatoriedad.</p>
 *
 * @param nombre Razón social o nombre comercial del proveedor.
 * @param contacto Información de contacto o enlace administrativo.
 * @param tiempoEntregaDias Plazo de entrega estándar negociado (en días).
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

