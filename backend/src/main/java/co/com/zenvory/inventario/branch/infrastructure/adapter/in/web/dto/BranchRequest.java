package co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

/**
 * Objeto de transferencia (DTO) para la creación o actualización de una sucursal.
 * 
 * <p>Define los criterios de validación sintáctica para el ingreso de datos 
 * desde la API REST.</p>
 * 
 * @param nombre Nombre comercial de la sede (obligatorio, máx 100 caracteres).
 * @param direccion Ubicación física (obligatorio, máx 200 caracteres).
 * @param telefono Número de contacto (opcional, entre 7 y 15 dígitos).
 * @param managerId ID del usuario gestor encargado de la sucursal (opcional).
 */
public record BranchRequest(

        @NotBlank(message = "El nombre es obligatorio")
        @Size(min = 3, max = 100, message = "El nombre debe tener entre 3 y 100 caracteres")
        String nombre,

        @NotBlank(message = "La dirección es obligatoria")
        @Size(min = 5, max = 200, message = "La dirección debe tener entre 5 y 200 caracteres")
        String direccion,

        @Pattern(regexp = "\\d{7,15}", message = "El teléfono debe contener entre 7 y 15 dígitos")
        String telefono,

        Long managerId

) {}