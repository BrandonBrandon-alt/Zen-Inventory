package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.shared.infrastructure.web.ErrorCode;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponse;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponseWriter;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.access.AccessDeniedHandler;
import org.springframework.stereotype.Component;

import java.io.IOException;

/** Responde 403 con el contrato JSON cuando un usuario autenticado no tiene permiso (reglas de filtro). */
@Component
public class RestAccessDeniedHandler implements AccessDeniedHandler {

    private final ErrorResponseWriter writer;

    public RestAccessDeniedHandler(ErrorResponseWriter writer) {
        this.writer = writer;
    }

    @Override
    public void handle(HttpServletRequest request, HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException {
        writer.write(response, ErrorResponse.of(HttpStatus.FORBIDDEN, ErrorCode.ACCESS_DENIED,
                "No tienes permisos para realizar esta acción.", request.getRequestURI(), ErrorResponse.newTraceId()));
    }
}
