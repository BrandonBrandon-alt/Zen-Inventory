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
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    @Test
    @DisplayName("GET /api/v1/purchases: returns 200")
    void getAll_returns200() throws Exception {
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.PENDING);
        when(order.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.POR_PAGAR);
        when(order.getDetails()).thenReturn(List.of());
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
        when(purchaseUseCase.approveOrder(1L, 1L)).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/approve?userId=1"))
                .andExpect(status().isOk());
    }
}

