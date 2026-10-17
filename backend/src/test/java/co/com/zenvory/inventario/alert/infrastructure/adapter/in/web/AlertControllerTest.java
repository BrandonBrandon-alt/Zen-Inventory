package co.com.zenvory.inventario.alert.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
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

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AlertController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AlertController — API Tests")
class AlertControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AlertUseCase alertUseCase;

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
    @DisplayName("GET /api/v1/alerts: returns 200")
    void getAll_returns200() throws Exception {
        StockAlert alert = mock(StockAlert.class);
        when(alert.getType()).thenReturn(co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType.LOW_STOCK);
        when(alertUseCase.getGlobalActiveAlerts()).thenReturn(List.of(alert));

        mockMvc.perform(get("/api/v1/alerts"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/v1/alerts/scan: returns 200")
    void scan_returns200() throws Exception {
        mockMvc.perform(post("/api/v1/alerts/scan"))
                .andExpect(status().isOk());
    }

    private void actAsManagerOfBranch(Long branchId) {
        co.com.zenvory.inventario.auth.domain.model.User manager = co.com.zenvory.inventario.auth.domain.model.User.builder()
                .id(5L).email("test@example.com").nombre("Gerente").sucursalId(branchId)
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("MANAGER").build()).build();
        org.mockito.Mockito.when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(java.util.Optional.of(manager));
    }

    @Test
    @DisplayName("resolver o descartar una alerta de otra sucursal es 403 y no cambia nada")
    void actionsOnOtherBranchAlert_return403() throws Exception {
        actAsManagerOfBranch(1L);
        co.com.zenvory.inventario.alert.domain.model.StockAlert alert = co.com.zenvory.inventario.alert.domain.model.StockAlert.create(2L, 3L, "x");
        when(alertUseCase.getAlertById(10L)).thenReturn(alert);
        mockMvc.perform(patch("/api/v1/alerts/10/resolve")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/alerts/10/resolve/dismiss").contentType("application/json").content("{\"reason\":\"x\"}"))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/alerts/10/resolve/purchase").contentType("application/json")
                .content("{\"leadTimeDays\":1,\"quantity\":1,\"userId\":1,\"supplierId\":1}")).andExpect(status().isForbidden());
        org.mockito.Mockito.verify(alertUseCase, org.mockito.Mockito.never()).resolveAlert(org.mockito.ArgumentMatchers.any());
        org.mockito.Mockito.verify(alertUseCase, org.mockito.Mockito.never()).dismissAlert(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("la orden de compra por alerta se crea a nombre del usuario de la sesión, no del userId del cuerpo")
    void purchaseFromAlertUsesSessionUser() throws Exception {
        actAsManagerOfBranch(1L);
        when(alertUseCase.getAlertById(10L)).thenReturn(co.com.zenvory.inventario.alert.domain.model.StockAlert.create(1L, 3L, "x"));
        mockMvc.perform(post("/api/v1/alerts/10/resolve/purchase").contentType("application/json")
                .content("{\"leadTimeDays\":1,\"quantity\":1,\"userId\":99,\"supplierId\":1}")).andExpect(status().isOk());
        org.mockito.Mockito.verify(alertUseCase).resolveViaPurchaseOrder(org.mockito.ArgumentMatchers.eq(10L), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.anyBoolean(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("un MANAGER sin sucursal asignada no obtiene alertas de ninguna sucursal (403, no listado global)")
    void listWithoutBranchIs403() throws Exception {
        actAsManagerOfBranch(null);
        mockMvc.perform(get("/api/v1/alerts")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/alerts?branchId=2")).andExpect(status().isForbidden());
        org.mockito.Mockito.verify(alertUseCase, org.mockito.Mockito.never()).getGlobalActiveAlerts();
    }

    @Test
    @DisplayName("un MANAGER solo ve las alertas de su sucursal aunque pida otra en la consulta")
    void listIsScopedToOwnBranch() throws Exception {
        actAsManagerOfBranch(1L);
        when(alertUseCase.getActiveAlerts(1L)).thenReturn(java.util.List.of());
        mockMvc.perform(get("/api/v1/alerts?branchId=2")).andExpect(status().isOk());
        org.mockito.Mockito.verify(alertUseCase).getActiveAlerts(1L);
        org.mockito.Mockito.verify(alertUseCase, org.mockito.Mockito.never()).getActiveAlerts(2L);
    }

    @Test
    @DisplayName("resolver sin datos obligatorios es 400 y no llega al servicio")
    void resolveWithoutRequiredFieldsIs400() throws Exception {
        actAsManagerOfBranch(1L);
        when(alertUseCase.getAlertById(10L)).thenReturn(co.com.zenvory.inventario.alert.domain.model.StockAlert.create(1L, 3L, "x"));
        mockMvc.perform(post("/api/v1/alerts/10/resolve/transfer").contentType("application/json").content("{\"quantity\": 0}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/alerts/10/resolve/purchase").contentType("application/json").content("{\"quantity\": 5}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verify(alertUseCase, org.mockito.Mockito.never()).resolveViaTransfer(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }
}
