package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(PurchaseController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("PurchaseController — API Tests")
class PurchaseControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private PurchaseUseCase purchaseUseCase;

    @MockitoBean
    private co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort userRepositoryPort;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @org.junit.jupiter.api.BeforeEach
    void authenticateAdmin() {
        var auth = mock(org.springframework.security.core.Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        var context = mock(org.springframework.security.core.context.SecurityContext.class);
        when(context.getAuthentication()).thenReturn(auth);
        org.springframework.security.core.context.SecurityContextHolder.setContext(context);
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(java.util.Optional.of(
                co.com.zenvory.inventario.auth.domain.model.User.builder().id(1L).email("test@example.com").nombre("Admin")
                        .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("ADMIN").build()).build()));
    }

    @MockitoBean
    private JwtService jwtService;

    @Test
    @DisplayName("GET /api/v1/purchases: returns 200")
    void getAll_returns200() throws Exception {
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.PENDING);
        when(order.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.POR_PAGAR);
        when(order.getDetails()).thenReturn(List.of());
        when(order.getBranchId()).thenReturn(3L);
        when(purchaseUseCase.getAllOrders()).thenReturn(List.of(order));

        mockMvc.perform(get("/api/v1/purchases"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /api/v1/purchases/1/approve: returns 200")
    void approve_returns200() throws Exception {
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.PENDING);
        when(order.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.POR_PAGAR);
        when(order.getDetails()).thenReturn(List.of());
        when(order.getBranchId()).thenReturn(3L);
        when(purchaseUseCase.getOrderById(1L)).thenReturn(order);
        when(purchaseUseCase.approveOrder(1L, 1L)).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/approve?userId=1"))
                .andExpect(status().isOk());
    }

    private void actAsManagerOfBranch(Long branchId) {
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(java.util.Optional.of(
                co.com.zenvory.inventario.auth.domain.model.User.builder().id(5L).email("test@example.com").nombre("Gerente").sucursalId(branchId)
                        .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("MANAGER").build()).build()));
    }

    @Test
    @DisplayName("operar sobre una orden de otra sucursal es 403 y no cambia nada")
    void actionsOnOtherBranchOrder_return403() throws Exception {
        actAsManagerOfBranch(1L);
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getBranchId()).thenReturn(2L);
        when(purchaseUseCase.getOrderById(1L)).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/approve")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/purchases/1/dispatch")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/purchases/1/pay")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/purchases/1")).andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/purchases/1/receive").contentType("application/json")
                .content("{\"userId\": 99, \"items\": []}")).andExpect(status().isForbidden());
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).approveOrder(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).receiveOrder(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("la aprobación queda a nombre del usuario de la sesión aunque la URL traiga otro userId")
    void approveUsesSessionUser() throws Exception {
        actAsManagerOfBranch(1L);
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getBranchId()).thenReturn(1L);
        when(order.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.PENDING);
        when(order.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.POR_PAGAR);
        when(order.getDetails()).thenReturn(List.of());
        when(purchaseUseCase.getOrderById(1L)).thenReturn(order);
        when(purchaseUseCase.approveOrder(1L, 5L)).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/approve?userId=99")).andExpect(status().isOk());
        org.mockito.Mockito.verify(purchaseUseCase).approveOrder(1L, 5L);
    }

    @Test
    @DisplayName("el listado de un MANAGER solo trae las órdenes de su sucursal")
    void listIsScopedToBranch() throws Exception {
        actAsManagerOfBranch(1L);
        PurchaseOrder mine = mock(PurchaseOrder.class);
        PurchaseOrder other = mock(PurchaseOrder.class);
        for (PurchaseOrder o : List.of(mine, other)) {
            when(o.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.PENDING);
            when(o.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.POR_PAGAR);
            when(o.getDetails()).thenReturn(List.of());
        }
        when(mine.getBranchId()).thenReturn(1L);
        when(mine.getId()).thenReturn(10L);
        when(other.getBranchId()).thenReturn(2L);
        when(other.getId()).thenReturn(20L);
        when(purchaseUseCase.getAllOrders()).thenReturn(List.of(mine, other));

        mockMvc.perform(get("/api/v1/purchases")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
}
