package co.com.zenvory.inventario.analytics.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.analytics.application.port.in.AnalyticsUseCase;
import co.com.zenvory.inventario.analytics.domain.model.DashboardAnalyticsResponse;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
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

import java.util.Optional;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AnalyticsController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AnalyticsController — API Tests")
class AnalyticsControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AnalyticsUseCase analyticsUseCase;

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
    @DisplayName("GET /api/v1/analytics/dashboard: returns 200")
    void getDashboard_returns200() throws Exception {
        DashboardAnalyticsResponse response = mock(DashboardAnalyticsResponse.class);
        when(analyticsUseCase.getDashboardData(any(), any(), any())).thenReturn(response);

        mockMvc.perform(get("/api/v1/analytics/dashboard"))
                .andExpect(status().isOk());
    }

    private void actAs(String role, Long branchId) {
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(Optional.of(User.builder()
                .id(2L).email("test@example.com").nombre("Persona").sucursalId(branchId)
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre(role).build()).build()));
    }

    @Test
    @DisplayName("un gerente solo consulta los datos de su sucursal")
    void managerIsScopedToOwnBranch() throws Exception {
        actAs("MANAGER", 7L);
        when(analyticsUseCase.getBranchValuations(any())).thenReturn(java.util.List.of());

        mockMvc.perform(get("/api/v1/analytics/valuations")).andExpect(status().isOk());
        org.mockito.Mockito.verify(analyticsUseCase).getBranchValuations(7L);
    }

    @Test
    @DisplayName("el ADMIN consulta todas las sucursales (sin filtro)")
    void adminSeesEverything() throws Exception {
        when(analyticsUseCase.getBranchValuations(any())).thenReturn(java.util.List.of());

        mockMvc.perform(get("/api/v1/analytics/valuations")).andExpect(status().isOk());
        org.mockito.Mockito.verify(analyticsUseCase).getBranchValuations(null);
    }

    @Test
    @DisplayName("un gerente u operador sin sucursal asignada es 403: no recibe los datos de todas")
    void nonAdminWithoutBranchIsForbidden() throws Exception {
        for (String role : new String[] {"MANAGER", "OPERADOR_INVENTARIO"}) {
            actAs(role, null);
            mockMvc.perform(get("/api/v1/analytics/valuations")).andExpect(status().isForbidden());
            mockMvc.perform(get("/api/v1/analytics/dashboard")).andExpect(status().isForbidden());
        }
        org.mockito.Mockito.verify(analyticsUseCase, org.mockito.Mockito.never()).getBranchValuations(any());
        org.mockito.Mockito.verify(analyticsUseCase, org.mockito.Mockito.never()).getDashboardData(any(), any(), any());
    }

    @Test
    @DisplayName("GET /api/v1/analytics/top-products: returns 200")
    void getTopSelling_returns200() throws Exception {
        when(analyticsUseCase.getTopSellingProducts(anyInt(), any(), any(), any())).thenReturn(java.util.List.of());

        mockMvc.perform(get("/api/v1/analytics/top-products?limit=5"))
                .andExpect(status().isOk());
    }
}

