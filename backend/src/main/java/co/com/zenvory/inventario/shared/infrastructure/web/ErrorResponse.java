package co.com.zenvory.inventario.shared.infrastructure.web;

import java.time.LocalDateTime;

/**
 * DTO de respuesta de error uniforme para toda la API.
 * Todos los errores retornan este mismo formato JSON para
 * facilitar el consumo desde el cliente.
 */
public record ErrorResponse(
        String message,
        LocalDateTime timestamp
) {
    public ErrorResponse(String message) {
        this(message, LocalDateTime.now());
    }
}
