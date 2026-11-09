package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.AuthUseCase;
import co.com.zenvory.inventario.auth.domain.model.LoginResult;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.LoginRequest;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AuthController — API Tests")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private AuthUseCase authUseCase;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    @Test
    @DisplayName("POST /api/auth/login: returns 200 with JWT")
    void login_returns200() throws Exception {
        LoginRequest request = new LoginRequest("user@example.com", "pass");
        User user = User.builder()
                .id(1L)
                .email("user@example.com")
                .nombre("Test User")
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("ADMIN").build())
                .build();
        LoginResult result = new LoginResult("mock-jwt-token", user);
        
        when(authUseCase.login(anyString(), anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(result);

        mockMvc.perform(post("/api/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mock-jwt-token"));
    }

    @Test
    @DisplayName("POST /api/auth/login: pasa la IP del cliente (la primera de X-Forwarded-For detrás de un proxy)")
    void login_passesClientIp() throws Exception {
        User user = User.builder().id(1L).email("user@example.com").nombre("U")
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("ADMIN").build()).build();
        when(authUseCase.login(anyString(), anyString(), org.mockito.ArgumentMatchers.any())).thenReturn(new LoginResult("t", user));

        mockMvc.perform(post("/api/auth/login").header("X-Forwarded-For", "181.50.1.2, 10.0.0.1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(new LoginRequest("user@example.com", "pass"))))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(authUseCase).login("user@example.com", "pass", "181.50.1.2");
    }
}

