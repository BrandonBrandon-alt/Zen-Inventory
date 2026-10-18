package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.sale.application.port.in.ReturnRequestUseCase;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
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

@WebMvcTest(ReturnRequestController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ReturnRequestController — API Tests")
class ReturnRequestControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private ReturnRequestUseCase returnRequestUseCase;

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
    @DisplayName("GET /api/v1/returns/pending: returns 200")
    void getPending_returns200() throws Exception {
        ReturnRequest req = mock(ReturnRequest.class);
        when(returnRequestUseCase.getPendingRequestsByBranch(any())).thenReturn(List.of(req));

        mockMvc.perform(get("/api/v1/returns/pending?branchId=1"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/v1/returns/{id}/approve: returns 204")
    void approve_returns204() throws Exception {
        ReturnRequest req = mock(ReturnRequest.class);
        when(req.getBranchId()).thenReturn(3L);
        when(returnRequestUseCase.getRequestById(1L)).thenReturn(req);
        mockMvc.perform(post("/api/v1/returns/1/approve?comment=OK"))
                .andExpect(status().isNoContent());
    }

    private void actAsManagerOfBranch(Long branchId) {
        User manager = User.builder().id(5L).email("test@example.com").nombre("Gerente").sucursalId(branchId)
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("MANAGER").build()).build();
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(Optional.of(manager));
    }

    @Test
    @DisplayName("un MANAGER no puede aprobar devoluciones de otra sucursal (403)")
    void approve_otherBranch_returns403() throws Exception {
        actAsManagerOfBranch(1L);
        ReturnRequest req = mock(ReturnRequest.class);
        when(req.getBranchId()).thenReturn(2L);
        when(returnRequestUseCase.getRequestById(1L)).thenReturn(req);

        mockMvc.perform(post("/api/v1/returns/1/approve?comment=OK"))
                .andExpect(status().isForbidden());
        org.mockito.Mockito.verify(returnRequestUseCase, org.mockito.Mockito.never()).approveRequest(any(), any(), any());
    }

    @Test
    @DisplayName("un MANAGER no puede listar las devoluciones de otra sucursal (403)")
    void listOtherBranch_returns403() throws Exception {
        actAsManagerOfBranch(1L);
        mockMvc.perform(get("/api/v1/returns/branch/2")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/returns/pending?branchId=2")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("quien aprueba es el usuario de la sesión, no uno indicado en la petición")
    void approve_usesSessionUser() throws Exception {
        actAsManagerOfBranch(1L);
        ReturnRequest req = mock(ReturnRequest.class);
        when(req.getBranchId()).thenReturn(1L);
        when(returnRequestUseCase.getRequestById(1L)).thenReturn(req);

        mockMvc.perform(post("/api/v1/returns/1/approve?comment=OK")).andExpect(status().isNoContent());
        org.mockito.Mockito.verify(returnRequestUseCase).approveRequest(1L, 5L, "OK");
    }
}
