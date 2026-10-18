package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.UserUseCase;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto.UserRequest;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("UserController — API Tests")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private UserUseCase userUseCase;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    private static final java.security.Principal ACTOR = () -> "admin@x.co";

    private User sampleUser;

    @BeforeEach
    void setUp() {
        sampleUser = User.builder()
                .id(1L)
                .nombre("testuser")
                .email("test@example.com")
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().id(1L).nombre("ADMIN").build())
                .active(true)
                .createdAt(java.time.LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("GET /api/users: returns 200")
    void getAll_returns200() throws Exception {
        when(userUseCase.getAllUsers(any())).thenReturn(List.of(sampleUser));

        mockMvc.perform(get("/api/users").principal(ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    @DisplayName("GET /api/users/{id}: returns 200")
    void getById_returns200() throws Exception {
        when(userUseCase.getUserById(eq(1L), any())).thenReturn(sampleUser);

        mockMvc.perform(get("/api/users/1").principal(ACTOR))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("testuser"));
    }

    @Test
    @DisplayName("POST /api/users: returns 201")
    void create_returns201() throws Exception {
        UserRequest request = new UserRequest("testuser", "test@example.com", "password", 1L, 1L, true);
        when(userUseCase.createUser(any(User.class), any(), any())).thenReturn(sampleUser);

        mockMvc.perform(post("/api/users").principal(ACTOR)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("POST /api/users: una violación de alcance responde 403 FORBIDDEN_ACTION")
    void create_outOfScope_returns403() throws Exception {
        UserRequest request = new UserRequest("testuser", "test@example.com", "password", 1L, 1L, true);
        when(userUseCase.createUser(any(User.class), any(), any()))
                .thenThrow(new co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException("No puede asignar el rol ADMIN."));

        mockMvc.perform(post("/api/users").principal(ACTOR)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("FORBIDDEN_ACTION"));
    }

    @Test
    @DisplayName("DELETE /api/users/{id}: returns 204")
    void deactivate_returns204() throws Exception {
        mockMvc.perform(delete("/api/users/1").principal(ACTOR))
                .andExpect(status().isNoContent());
    }
}
