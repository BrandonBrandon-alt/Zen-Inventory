package co.com.zenvory.inventario.shared.infrastructure.web;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * DTO compartido para solicitudes de resolución (Cancelación, Rechazo, etc.)
 * que requieren un motivo y el ID del usuario que realiza la acción.
 */
public record ResolutionRequest(
        @NotBlank(message = "El motivo de resolución es obligatorio")
        String reason,

        @NotNull(message = "El ID de usuario es obligatorio")
        Long userId
) {}
