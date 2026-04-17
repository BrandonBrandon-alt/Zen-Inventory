package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
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

        if (!jwtService.isTokenValid(token)) {
            filterChain.doFilter(request, response);
            return;
        }

        String email = jwtService.extractEmail(token);

        // Solo autenticar si no hay una autenticación previa en el contexto
        if (email != null && SecurityContextHolder.getContext().getAuthentication() == null) {
            UserEntity user = userRepository.findByEmail(email).orElse(null);

            if (user != null) {
                String roleName = "ROLE_" + user.getRole().getNombre();
                UsernamePasswordAuthenticationToken authToken =
                        new UsernamePasswordAuthenticationToken(
                                email,
                                null,
                                List.of(new SimpleGrantedAuthority(roleName))
                        );
                authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                SecurityContextHolder.getContext().setAuthentication(authToken);
            }
        }

        filterChain.doFilter(request, response);
    }
}
