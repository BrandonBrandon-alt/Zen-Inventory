package co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * DTO de entrada para crear una sucursal.
 * Las validaciones están aquí (capa de infraestructura) y no en el dominio,
 * porque son reglas del protocolo HTTP, no invariantes de negocio.
 */
public record BranchRequest(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(max = 100, message = "El nombre no puede superar los 100 caracteres")
        String nombre,

        @NotBlank(message = "La dirección es obligatoria")
        @Size(max = 200, message = "La dirección no puede superar los 200 caracteres")
        String direccion,

        @Pattern(regexp = "\\d{7,15}", message = "El teléfono debe contener entre 7 y 15 dígitos")
        String telefono

) {}