package co.com.zenvory.inventario.shared.infrastructure.security;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import java.util.List;

import static org.springframework.security.config.Customizer.withDefaults;

/**
 * Configuración central de Spring Security.
 *
 * <p>Decisiones de diseño:
 * <ul>
 *   <li><b>Stateless (JWT)</b>: No se usa sesión HTTP — cada petición debe incluir el token.</li>
 *   <li><b>CSRF desactivado</b>: Las APIs REST stateless no requieren protección CSRF.</li>
 *   <li><b>Endpoints públicos</b>: Solo {@code POST /api/auth/login} es libre.</li>
 *   <li><b>@EnableMethodSecurity</b>: Permite usar {@code @PreAuthorize("hasRole('ADMIN')")}
 *       en controladores para control de acceso granular por rol.</li>
 * </ul>
 */
@Configuration
@EnableWebSecurity
@EnableMethodSecurity
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtAuthFilter;

    public SecurityConfig(JwtAuthenticationFilter jwtAuthFilter) {
        this.jwtAuthFilter = jwtAuthFilter;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        return http
                .cors(withDefaults())
                .csrf(AbstractHttpConfigurer::disable)
                .sessionManagement(session ->
                        session.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        // Endpoint de login: público
                        .requestMatchers(HttpMethod.POST, "/api/auth/login").permitAll()
                        // Swagger/OpenAPI (si se agrega en el futuro)
                        .requestMatchers("/v3/api-docs/**", "/swagger-ui/**").permitAll()
                        // Todo lo demás requiere autenticación
                        .anyRequest().authenticated()
                )
                .addFilterBefore(jwtAuthFilter, UsernamePasswordAuthenticationFilter.class)
                .build();
    }

    /**
     * BCryptPasswordEncoder usado para verificar contraseñas en el login.
     * El seed data (V4) ya guarda los password_hash en BCrypt.
     */
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    /**
     * Configuración de CORS para permitir solicitudes del Frontend
     * (Ej. Next.js o React ejecutándose en localhost:3000)
     */
    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOriginPatterns(List.of("http://localhost:*")); // Permite cualquier puerto local (e.g. 3000, 5173)
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true); // Necesario si envían cookies o auth headers

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }
}
