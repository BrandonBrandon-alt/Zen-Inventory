package co.com.zenvory.inventario.shared.infrastructure.security;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.web.ErrorResponseWriter;
import co.com.zenvory.inventario.shared.infrastructure.web.GlobalExceptionHandler;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** CORS y documentación de la API dependen de la configuración del despliegue, no de valores fijos en el código. */
@DisplayName("SecurityConfig — CORS y documentación por configuración")
class SecurityConfigTest {

    @RestController
    static class Probe {
        @GetMapping("/api/probe/any")
        String any() {
            return "ok";
        }
    }

    @WebMvcTest(controllers = Probe.class)
    @Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class, RestAuthenticationEntryPoint.class,
            RestAccessDeniedHandler.class, ErrorResponseWriter.class, GlobalExceptionHandler.class, Probe.class})
    @TestPropertySource(properties = {"app.cors.allowed-origins=https://app.zen.co, http://localhost:*", "app.docs.public=false"})
    @Nested
    @DisplayName("producción (orígenes definidos, documentación cerrada)")
    class Production {
        @Autowired MockMvc mockMvc;
        @MockitoBean JpaUserRepository userRepository;

        private org.springframework.test.web.servlet.ResultActions preflight(String origin) throws Exception {
            return mockMvc.perform(options("/api/probe/any")
                    .header("Origin", origin)
                    .header("Access-Control-Request-Method", "GET")
                    .header("Access-Control-Request-Headers", "authorization,accept-language"));
        }

        @Test
        @DisplayName("un origen configurado puede llamar, con las cabeceras habituales")
        void configuredOriginAllowed() throws Exception {
            preflight("https://app.zen.co").andExpect(status().isOk())
                    .andExpect(header().string("Access-Control-Allow-Origin", "https://app.zen.co"));
        }

        @Test
        @DisplayName("un origen no configurado queda bloqueado")
        void otherOriginBlocked() throws Exception {
            preflight("https://evil.example").andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("la documentación exige sesión")
        void docsRequireSession() throws Exception {
            mockMvc.perform(get("/v3/api-docs")).andExpect(status().isUnauthorized());
            mockMvc.perform(get("/swagger-ui/index.html")).andExpect(status().isUnauthorized());
        }
    }

    @WebMvcTest(controllers = Probe.class)
    @Import({SecurityConfig.class, JwtAuthenticationFilter.class, JwtService.class, RestAuthenticationEntryPoint.class,
            RestAccessDeniedHandler.class, ErrorResponseWriter.class, GlobalExceptionHandler.class, Probe.class})
    @TestPropertySource(properties = {"app.docs.public=true"})
    @Nested
    @DisplayName("desarrollo (documentación abierta, sin orígenes configurados)")
    class Development {
        @Autowired MockMvc mockMvc;
        @MockitoBean JpaUserRepository userRepository;

        @Test
        @DisplayName("la documentación no exige sesión")
        void docsOpen() throws Exception {
            int status = mockMvc.perform(get("/v3/api-docs")).andReturn().getResponse().getStatus();
            assertThat(status).isNotEqualTo(401);
        }

        @Test
        @DisplayName("sin orígenes configurados no se permite ninguno")
        void noOriginsByDefault() throws Exception {
            mockMvc.perform(options("/api/probe/any").header("Origin", "http://localhost:3000")
                    .header("Access-Control-Request-Method", "GET")).andExpect(status().isForbidden());
        }
    }
}
