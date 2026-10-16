package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.RoleEntity;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.UserEntity;
import co.com.zenvory.inventario.shared.infrastructure.web.GlobalExceptionHandler;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * Los fallos de autenticación/autorización resueltos por la cadena de filtros de Spring Security
 * (antes de llegar a un controlador) deben seguir el mismo contrato JSON que el resto de errores.
 */
@WebMvcTest(controllers = SecurityErrorResponsesTest.SecuredProbe.class)
@Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class,
        RestAuthenticationEntryPoint.class, RestAccessDeniedHandler.class,
        co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponseWriter.class,
        GlobalExceptionHandler.class, SecurityErrorResponsesTest.SecuredProbe.class})
@DisplayName("Seguridad — respuestas de error 401/403 con contrato JSON")
class SecurityErrorResponsesTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @MockitoBean
    private JpaUserRepository userRepository;

    @Value("${security.jwt.secret}")
    private String secret;

    @BeforeEach
    void setUp() {
        when(userRepository.findByEmail(anyString())).thenReturn(Optional.empty());
        when(userRepository.findByEmail("ana@zen.com")).thenReturn(Optional.of(user("ana@zen.com", "MANAGER")));
        when(userRepository.findByEmail("inactiva@zen.com")).thenReturn(Optional.of(
                UserEntity.builder().id(3L).email("inactiva@zen.com").nombre("Inactiva").activa(false)
                        .role(RoleEntity.builder().id(2L).nombre("MANAGER").build()).build()));
        when(userRepository.findByEmail("root@zen.com")).thenReturn(Optional.of(user("root@zen.com", "ADMIN")));
    }

    private static UserEntity user(String email, String role) {
        return UserEntity.builder().id(1L).email(email).nombre("Test")
                .role(RoleEntity.builder().id(1L).nombre(role).build()).build();
    }

    private static String bearer(String token) {
        return "Bearer " + token;
    }

    @Test
    @DisplayName("Sin token: 401 UNAUTHENTICATED (antes era un 403 con cuerpo vacío)")
    void withoutToken() throws Exception {
        mockMvc.perform(get("/api/probe/any"))
                .andExpect(status().isUnauthorized())
                .andExpect(content().contentTypeCompatibleWith(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"))
                .andExpect(jsonPath("$.path").value("/api/probe/any"))
                .andExpect(jsonPath("$.message").isNotEmpty())
                .andExpect(jsonPath("$.traceId").isNotEmpty())
                .andExpect(jsonPath("$.timestamp").exists());
    }

    @Test
    @DisplayName("Encabezado que no es Bearer: 401 UNAUTHENTICATED")
    void nonBearerHeader() throws Exception {
        mockMvc.perform(get("/api/probe/any").header("Authorization", "Basic abc"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("UNAUTHENTICATED"));
    }

    @Test
    @DisplayName("Token basura: 401 INVALID_TOKEN")
    void garbageToken() throws Exception {
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer("abc.def.ghi")))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    @DisplayName("Token firmado con otra clave: 401 INVALID_TOKEN")
    void tokenSignedWithAnotherKey() throws Exception {
        String forged = new JwtService("otra-clave-secreta-de-al-menos-32-bytes-0123456789", 60_000)
                .generateToken(1L, "ana@zen.com");
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(forged)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    @DisplayName("Token vencido: 401 TOKEN_EXPIRED, para que el frontend cierre la sesión")
    void expiredToken() throws Exception {
        String expired = new JwtService(secret, -5_000).generateToken(1L, "ana@zen.com");
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(expired)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("TOKEN_EXPIRED"))
                .andExpect(jsonPath("$.message").value("Tu sesión expiró. Inicia sesión de nuevo."));
    }

    @Test
    @DisplayName("Token válido de un usuario que ya no existe: 401 INVALID_TOKEN")
    void validTokenOfDeletedUser() throws Exception {
        String token = jwtService.generateToken(99L, "borrado@zen.com");
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    @DisplayName("Token de otra persona con el mismo correo (correo reasignado): 401 INVALID_TOKEN")
    void tokenOfPreviousOwnerOfTheEmail() throws Exception {
        String token = jwtService.generateToken(55L, "ana@zen.com"); // ana@zen.com es hoy el usuario 1
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    @DisplayName("Token sin identidad de usuario (emitido antes del claim uid): 401 INVALID_TOKEN")
    void tokenWithoutUserId() throws Exception {
        String legacy = io.jsonwebtoken.Jwts.builder().subject("ana@zen.com")
                .expiration(new java.util.Date(System.currentTimeMillis() + 60_000))
                .signWith(io.jsonwebtoken.security.Keys.hmacShaKeyFor(secret.getBytes(java.nio.charset.StandardCharsets.UTF_8)))
                .compact();
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(legacy)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("INVALID_TOKEN"));
    }

    @Test
    @DisplayName("Token válido de una cuenta desactivada: 401 ACCOUNT_DISABLED")
    void validTokenOfDisabledUser() throws Exception {
        String token = jwtService.generateToken(3L, "inactiva@zen.com");
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(token)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("ACCOUNT_DISABLED"));
    }

    @Test
    @DisplayName("Token válido: el recurso responde con normalidad")
    void validToken() throws Exception {
        String token = jwtService.generateToken(1L, "ana@zen.com");
        mockMvc.perform(get("/api/probe/any").header("Authorization", bearer(token)))
                .andExpect(status().isOk())
                .andExpect(content().string("ok"));
    }

    @Test
    @DisplayName("Autenticado sin el rol necesario: 403 ACCESS_DENIED con contrato JSON")
    void authenticatedWithoutRole() throws Exception {
        String token = jwtService.generateToken(1L, "ana@zen.com");
        mockMvc.perform(get("/api/probe/admin").header("Authorization", bearer(token)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.status").value(403))
                .andExpect(jsonPath("$.code").value("ACCESS_DENIED"))
                .andExpect(jsonPath("$.path").value("/api/probe/admin"));
    }

    @Test
    @DisplayName("Con el rol necesario: 200")
    void authenticatedWithRole() throws Exception {
        String token = jwtService.generateToken(1L, "root@zen.com");
        mockMvc.perform(get("/api/probe/admin").header("Authorization", bearer(token)))
                .andExpect(status().isOk());
    }

    @RestController
    @RequestMapping("/api/probe")
    static class SecuredProbe {

        @GetMapping("/any")
        String any() {
            return "ok";
        }

        @GetMapping("/admin")
        @PreAuthorize("hasRole('ADMIN')")
        String admin() {
            return "admin";
        }
    }
}
