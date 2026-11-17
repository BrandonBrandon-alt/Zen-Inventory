package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.AuthUseCase;
import co.com.zenvory.inventario.auth.domain.model.LoginResult;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.LoginRequest;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.LoginResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

/**
 * Adaptador de entrada REST para autenticación.
 *
 * <p>Expone un único endpoint público:
 * {@code POST /api/auth/login} → retorna un JWT.</p>
 *
 * <p>Este endpoint está permitido sin autenticación en {@code SecurityConfig}.</p>
 */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthUseCase authUseCase;

    public AuthController(AuthUseCase authUseCase) {
        this.authUseCase = authUseCase;
    }

    /**
     * POST /api/auth/login
     *
     * <p>Cuerpo esperado:
     * <pre>{@code
     * {
     *   "email": "admin@zenvory.co",
     *   "password": "admin123"
     * }
     * }</pre>
     *
     * <p>Respuesta exitosa (200):
     * <pre>{@code
     * {
     *   "token": "eyJhbGciOiJIUzI1NiJ9...",
     *   "tipo": "Bearer",
     *   "email": "admin@zenvory.co"
     * }
     * }</pre>
     */
    @PostMapping("/login")
    public ResponseEntity<LoginResponse> login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        LoginResult result = authUseCase.login(request.email(), request.password(), clientIp(http));
        return ResponseEntity.ok(new LoginResponse(
            result.token(), 
            result.user().getEmail(),
            result.user().getNombre(),
            result.user().getRole().getNombre(),
            result.user().getSucursalId(),
            result.user().getId(),
            result.user().getAvatarUpdatedAt()
        ));
    }

    /**
     * IP de quien inicia sesión. En la nube la petición llega por proxies (Netlify, Render), que ponen la del cliente
     * primera en {@code X-Forwarded-For}; sin esa cabecera, la de la conexión. Solo se usa para la auditoría.
     */
    static String clientIp(HttpServletRequest request) {
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}
