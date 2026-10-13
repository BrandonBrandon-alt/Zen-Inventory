package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.shared.infrastructure.web.ErrorCode;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponse;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponseWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.AuthenticationEntryPoint;
import org.springframework.stereotype.Component;

import java.io.IOException;

/**
 * Responde 401 con el contrato JSON cuando se accede sin autenticación válida.
 *
 * <p>Sin este componente Spring Security devolvía 403 con cuerpo vacío, y el frontend no podía distinguir
 * "no has iniciado sesión / tu sesión venció" de "no tienes permiso". El código del error lo decide
 * {@link JwtAuthenticationFilter}, que deja el motivo en un atributo de la petición.</p>
 */
@Component
public class RestAuthenticationEntryPoint implements AuthenticationEntryPoint {

    /** Atributo de la petición donde el filtro JWT deja el {@link ErrorCode} del token rechazado. */
    public static final String AUTH_ERROR_ATTRIBUTE = "zen.auth.error";

    private final ErrorResponseWriter writer;

    public RestAuthenticationEntryPoint(ErrorResponseWriter writer) {
        this.writer = writer;
    }

    @Override
    public void commence(HttpServletRequest request, HttpServletResponse response,
                         AuthenticationException authException) throws IOException {
        ErrorCode code = request.getAttribute(AUTH_ERROR_ATTRIBUTE) instanceof ErrorCode rejected
                ? rejected
                : ErrorCode.UNAUTHENTICATED;
        writer.write(response, ErrorResponse.of(HttpStatus.UNAUTHORIZED, code, messageFor(code),
                request.getRequestURI(), ErrorResponse.newTraceId()));
    }

    private static String messageFor(ErrorCode code) {
        return switch (code) {
            case TOKEN_EXPIRED -> "Tu sesión expiró. Inicia sesión de nuevo.";
            case INVALID_TOKEN -> "Tu sesión no es válida. Inicia sesión de nuevo.";
            default -> "Debes iniciar sesión para acceder a este recurso.";
        };
    }
}
