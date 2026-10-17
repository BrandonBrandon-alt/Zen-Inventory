package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorCode;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponse;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.UserEntity;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Filtro JWT que intercepta cada petición HTTP exactamente una vez.
 *
 * <p>Flujo:
 * <ol>
 *   <li>Extrae el token del header {@code Authorization: Bearer <token>}</li>
 *   <li>Valida la firma y expiración con {@link JwtService}</li>
 *   <li>Carga el usuario desde la BD usando el email del subject</li>
 *   <li>Inyecta la autenticación en el {@link SecurityContextHolder}</li>
 * </ol>
 * Si el token es inválido o ausente, la petición pasa sin autenticación
 * y Spring Security decide si rechazarla (401) o permitirla (endpoint público).
 */
@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    /** Atributo de la petición con el {@code User} de dominio ya cargado por este filtro. */
    public static final String AUTHENTICATED_USER_ATTRIBUTE = "zen.auth.user";

    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(JwtAuthenticationFilter.class);

    private final JwtService jwtService;
    private final JpaUserRepository userRepository;

    public JwtAuthenticationFilter(JwtService jwtService, JpaUserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @Override
    protected void doFilterInternal(
            @NonNull HttpServletRequest request,
            @NonNull HttpServletResponse response,
            @NonNull FilterChain filterChain) throws ServletException, IOException {

        final String authHeader = request.getHeader("Authorization");

        // Si no hay header Bearer, continuar sin autenticar
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        final String token = authHeader.substring(7);

        JwtService.TokenInfo info = jwtService.parse(token);
        if (info.status() != JwtService.TokenStatus.VALID) {
            // El motivo lo usa RestAuthenticationEntryPoint para responder 401 con el código correcto.
            request.setAttribute(RestAuthenticationEntryPoint.AUTH_ERROR_ATTRIBUTE,
                    info.status() == JwtService.TokenStatus.EXPIRED ? ErrorCode.TOKEN_EXPIRED : ErrorCode.INVALID_TOKEN);
            filterChain.doFilter(request, response);
            return;
        }

        String email = info.email();
        Long tokenUserId = info.userId();

        // Solo autenticar si no hay una autenticación previa en el contexto
        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            authenticate(request, email, tokenUserId);
        }

        filterChain.doFilter(request, response);
    }

    private void authenticate(HttpServletRequest request, String email, Long tokenUserId) {
        try {
            UserEntity user = userRepository.findByEmail(email).orElse(null);

            if (user == null || user.getRole() == null || !user.getId().equals(tokenUserId)) {
                // Usuario inexistente, correo reasignado a otra persona o token sin identidad: ya no sirve.
                request.setAttribute(RestAuthenticationEntryPoint.AUTH_ERROR_ATTRIBUTE, ErrorCode.INVALID_TOKEN);
            } else if (Boolean.FALSE.equals(user.getActiva())) {
                // Un token vigente de una cuenta desactivada no da acceso: se responde 401 ACCOUNT_DISABLED.
                request.setAttribute(RestAuthenticationEntryPoint.AUTH_ERROR_ATTRIBUTE, ErrorCode.ACCOUNT_DISABLED);
            } else {
                String roleName = "ROLE_" + user.getRole().getNombre();
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                email,
                                null,
                                List.of(new SimpleGrantedAuthority(roleName))
                        );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
                // Se deja el usuario cargado para que CurrentUser no lo vuelva a consultar en esta petición.
                request.setAttribute(AUTHENTICATED_USER_ATTRIBUTE, user.toDomain());
            }
        } catch (RuntimeException e) {
            // Un fallo de base de datos aquí ocurre antes del manejador de errores de los controladores: se registra
            // con un código de seguimiento y se responde 500 con el contrato JSON (vía RestAuthenticationEntryPoint).
            String traceId = ErrorResponse.newTraceId();
            log.error("[{}] Error al autenticar la petición {}", traceId, request.getRequestURI(), e);
            request.setAttribute(RestAuthenticationEntryPoint.AUTH_ERROR_ATTRIBUTE, ErrorCode.INTERNAL_ERROR);
            request.setAttribute(RestAuthenticationEntryPoint.AUTH_TRACE_ATTRIBUTE, traceId);
        }
    }
}
