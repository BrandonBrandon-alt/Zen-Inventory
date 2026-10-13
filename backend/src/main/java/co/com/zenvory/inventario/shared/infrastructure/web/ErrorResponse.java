package co.com.zenvory.inventario.shared.infrastructure.web;

import com.fasterxml.jackson.annotation.JsonInclude;
import org.springframework.http.HttpStatus;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

/**
 * DTO de respuesta de error uniforme para toda la API.
 *
 * <p>Compatible hacia atrás: {@code message} y {@code timestamp} se conservan tal cual. Los campos
 * {@code status}, {@code code}, {@code path}, {@code traceId} y {@code fieldErrors} son aditivos.</p>
 *
 * @param status      código HTTP de la respuesta
 * @param code        código estable de error (ver {@link ErrorCode}) para que el cliente decida qué hacer
 * @param message     texto legible para el usuario, en español
 * @param path        ruta de la petición que falló
 * @param traceId     identificador corto para correlacionar el error con el log del servidor
 * @param timestamp   momento del error
 * @param fieldErrors errores por campo (solo en fallos de validación)
 */
@JsonInclude(JsonInclude.Include.NON_EMPTY)
public record ErrorResponse(
        int status,
        String code,
        String message,
        String path,
        String traceId,
        LocalDateTime timestamp,
        List<FieldError> fieldErrors
) {

    /** Error asociado a un campo concreto del cuerpo de la petición. */
    public record FieldError(String field, String message) {}

    public static ErrorResponse of(HttpStatus status, ErrorCode code, String message, String path, String traceId) {
        return new ErrorResponse(status.value(), code.name(), message, path, traceId, LocalDateTime.now(), null);
    }

    public static ErrorResponse of(HttpStatus status, ErrorCode code, String message, String path,
                                   String traceId, List<FieldError> fieldErrors) {
        return new ErrorResponse(status.value(), code.name(), message, path, traceId, LocalDateTime.now(), fieldErrors);
    }

    /** Identificador corto (8 hex) suficiente para buscar el error en los logs. */
    public static String newTraceId() {
        return UUID.randomUUID().toString().replace("-", "").substring(0, 8);
    }
}
