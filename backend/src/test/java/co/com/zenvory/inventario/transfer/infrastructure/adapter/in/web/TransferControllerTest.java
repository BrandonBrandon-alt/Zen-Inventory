package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
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
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(TransferController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("TransferController — API Tests")
class TransferControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private TransferUseCase transferUseCase;

    @MockitoBean
    private UserRepositoryPort userRepositoryPort;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    @BeforeEach
    void setUp() {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        SecurityContext securityContext = mock(SecurityContext.class);
        when(securityContext.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(securityContext);

        User user = User.builder()
                .id(1L)
                .email("test@example.com")
                .nombre("Test User")
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("ADMIN").build())
                .build();
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(Optional.of(user));
    }

    @Test
    @DisplayName("GET /api/v1/transfers: returns 200")
    void getAll_returns200() throws Exception {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getStatus()).thenReturn(co.com.zenvory.inventario.transfer.domain.model.TransferStatus.PENDING);
        when(transfer.getDetails()).thenReturn(List.of());
        when(transferUseCase.getAllTransfers()).thenReturn(List.of(transfer));

        mockMvc.perform(get("/api/v1/transfers"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/v1/transfers: returns 201")
    void create_returns201() throws Exception {
        TransferRequest request = new TransferRequest(1L, 2L, java.time.LocalDateTime.now().plusDays(1), "NORMAL", List.of(
                new TransferRequest.TransferDetailRequest(1L, 10)
        ));
        Transfer transfer = mock(Transfer.class);
        when(transfer.getId()).thenReturn(1L);
        when(transfer.getStatus()).thenReturn(co.com.zenvory.inventario.transfer.domain.model.TransferStatus.PENDING);
        when(transfer.getDetails()).thenReturn(List.of());
        when(transferUseCase.requestTransfer(any())).thenReturn(transfer);

        mockMvc.perform(post("/api/v1/transfers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("GET /api/v1/transfers/fulfillment-report: returns 200")
    void getReport_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/transfers/fulfillment-report"))
                .andExpect(status().isOk());
    }
}

