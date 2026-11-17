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
        when(purchaseUseCase.getOrdersByBranch(1L)).thenReturn(List.of(mine));

        mockMvc.perform(get("/api/v1/purchases")).andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).getAllOrders();
    }

    @Test
    @DisplayName("el detalle de una orden con recepción parcial expone lo ya recibido")
    void detailExposesReceivedQuantity() throws Exception {
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.PENDING);
        when(order.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.POR_PAGAR);
        when(order.getBranchId()).thenReturn(3L);
        when(order.getDetails()).thenReturn(List.of(new co.com.zenvory.inventario.purchase.domain.model.PurchaseOrderDetail(
                7L, 1L, new java.math.BigDecimal("10"), new java.math.BigDecimal("5"), java.math.BigDecimal.ZERO, new java.math.BigDecimal("4"))));
        when(purchaseUseCase.getOrderById(1L)).thenReturn(order);

        mockMvc.perform(get("/api/v1/purchases/1")).andExpect(status().isOk())
                .andExpect(jsonPath("$.details[0].quantity").value(10))
                .andExpect(jsonPath("$.details[0].receivedQuantity").value(4));
    }

    @Test
    @DisplayName("una recepción con una línea repetida se rechaza (no se descarta una en silencio)")
    void receiveWithRepeatedLineRejected() throws Exception {
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getBranchId()).thenReturn(3L);
        when(purchaseUseCase.getOrderById(1L)).thenReturn(order);
        mockMvc.perform(post("/api/v1/purchases/1/receive").contentType("application/json")
                .content("{\"items\": [{\"detailId\": 7, \"quantityReceived\": 5}, {\"detailId\": 7, \"quantityReceived\": 3}]}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).receiveOrder(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("crear una orden con descuento fuera de 0-100 o plazo de pago negativo es 400")
    void createWithInvalidDiscountOrDueDays() throws Exception {
        String bad = "{\"supplierId\":1,\"branchId\":3,\"leadTimeDays\":2,\"paymentDueDays\":%d,\"items\":[{\"productId\":1,\"quantity\":1,\"unitPrice\":10,\"discountPct\":%d}]}";
        mockMvc.perform(post("/api/v1/purchases").contentType("application/json").content(String.format(bad, 30, 150))).andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/purchases").contentType("application/json").content(String.format(bad, -5, 10))).andExpect(status().isBadRequest());
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).createOrder(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyBoolean());
    }

    private PurchaseOrder orderForPayment() {
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getBranchId()).thenReturn(1L);
        when(order.getReceptionStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.RECEIVED_TOTAL);
        when(order.getPaymentStatus()).thenReturn(co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.PAGO_PARCIAL);
        when(order.getDetails()).thenReturn(List.of());
        when(order.getPayments()).thenReturn(List.of());
        when(purchaseUseCase.getOrderById(1L)).thenReturn(order);
        return order;
    }

    @Test
    @DisplayName("un abono se registra a nombre del usuario de la sesión, con su monto, método y referencia")
    void payRecordsPaymentWithSessionUser() throws Exception {
        actAsManagerOfBranch(1L);
        PurchaseOrder order = orderForPayment();
        when(purchaseUseCase.registerPayment(org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.any())).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/pay").contentType("application/json")
                .content("{\"amount\":400.50,\"method\":\"TRANSFERENCIA\",\"reference\":\"TR-1\",\"notes\":\"abono\",\"userId\":99}"))
                .andExpect(status().isOk());
        org.mockito.Mockito.verify(purchaseUseCase).registerPayment(org.mockito.ArgumentMatchers.eq(1L),
                org.mockito.ArgumentMatchers.eq(new java.math.BigDecimal("400.50")),
                org.mockito.ArgumentMatchers.eq(co.com.zenvory.inventario.purchase.domain.model.PaymentMethod.TRANSFERENCIA),
                org.mockito.ArgumentMatchers.eq("TR-1"), org.mockito.ArgumentMatchers.eq("abono"),
                org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.eq("Gerente"));
    }

    @Test
    @DisplayName("pagar sin cuerpo sigue funcionando y paga todo el saldo")
    void payWithoutBodyPaysBalance() throws Exception {
        actAsManagerOfBranch(1L);
        PurchaseOrder order = orderForPayment();
        when(purchaseUseCase.registerPayment(org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(), org.mockito.ArgumentMatchers.isNull(),
                org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.any())).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/pay")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("un monto en cero o negativo es 400 y no se registra nada")
    void payRejectsInvalidAmount() throws Exception {
        actAsManagerOfBranch(1L);
        orderForPayment();

        mockMvc.perform(post("/api/v1/purchases/1/pay").contentType("application/json").content("{\"amount\":0}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/purchases/1/pay").contentType("application/json").content("{\"amount\":-5}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).registerPayment(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("anular un pago lo hace a nombre del usuario de la sesión, con el motivo, y devuelve el pago anulado")
    void voidPayment_forwardsReasonAndShowsVoid() throws Exception {
        actAsManagerOfBranch(1L);
        PurchaseOrder order = orderForPayment();
        co.com.zenvory.inventario.purchase.domain.model.PurchasePayment voided = new co.com.zenvory.inventario.purchase.domain.model.PurchasePayment(
                3L, new java.math.BigDecimal("400"), java.time.LocalDateTime.of(2026, 10, 1, 9, 0), 2L, "Ana",
                co.com.zenvory.inventario.purchase.domain.model.PaymentMethod.TRANSFERENCIA, "TR-1", null,
                java.time.LocalDateTime.of(2026, 10, 2, 9, 0), 5L, "Gerente", "Duplicado");
        when(order.getPayments()).thenReturn(List.of(voided));
        when(purchaseUseCase.voidPayment(1L, 3L, "Duplicado", 5L, "Gerente")).thenReturn(order);

        mockMvc.perform(post("/api/v1/purchases/1/payments/3/void").contentType("application/json").content("{\"reason\":\"Duplicado\",\"userId\":99}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.payments[0].voidReason").value("Duplicado"))
                .andExpect(jsonPath("$.payments[0].voidedByUserName").value("Gerente"));
        org.mockito.Mockito.verify(purchaseUseCase).voidPayment(1L, 3L, "Duplicado", 5L, "Gerente");
    }

    @Test
    @DisplayName("anular un pago sin motivo es 400 y no anula nada")
    void voidPayment_requiresReason() throws Exception {
        actAsManagerOfBranch(1L);
        orderForPayment();
        mockMvc.perform(post("/api/v1/purchases/1/payments/3/void").contentType("application/json").content("{\"reason\":\" \"}"))
                .andExpect(status().isBadRequest());
        org.mockito.Mockito.verify(purchaseUseCase, org.mockito.Mockito.never()).voidPayment(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("GET /search: los parámetros llegan al criterio, con quién mira, y responde la página")
    void search_pasaLosParametros() throws Exception {
        var row = new co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Row(41L,
                co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus.IN_TRANSIT,
                co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.PAGO_PARCIAL, 1L, "Argos", 2L, "Norte",
                new java.math.BigDecimal("50000"), new java.math.BigDecimal("30000"), true, java.time.LocalDateTime.of(2026, 10, 11, 9, 0), true);
        when(purchaseUseCase.search(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(new co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Page(List.of(row), 30));

        mockMvc.perform(get("/api/v1/purchases/search?page=1&size=25&sortBy=total&direction=asc&status=IN_TRANSIT&payment=PAGO_PARCIAL"
                        + "&from=2026-10-01&to=2026-10-31&supplierId=1&branchId=2&productId=3&minTotal=10&maxTotal=90000&onlyMine=true").param("q", " argos "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(41))
                .andExpect(jsonPath("$.content[0].supplierName").value("Argos"))
                .andExpect(jsonPath("$.content[0].balance").value(30000))
                .andExpect(jsonPath("$.content[0].overdue").value(true))
                .andExpect(jsonPath("$.content[0].awaitsMe").value(true))
                .andExpect(jsonPath("$.totalElements").value(30))
                .andExpect(jsonPath("$.totalPages").value(2));

        var criteria = org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Criteria.class);
        org.mockito.Mockito.verify(purchaseUseCase).search(criteria.capture(), org.mockito.ArgumentMatchers.eq(new co.com.zenvory.inventario.shared.infrastructure.web.PageParams(1, 25)),
                org.mockito.ArgumentMatchers.eq("total"), org.mockito.ArgumentMatchers.eq(true));
        org.assertj.core.api.Assertions.assertThat(criteria.getValue()).isEqualTo(new co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Criteria(
                "IN_TRANSIT", co.com.zenvory.inventario.purchase.domain.model.PaymentStatus.PAGO_PARCIAL, java.time.LocalDate.of(2026, 10, 1), java.time.LocalDate.of(2026, 10, 31),
                1L, 2L, 3L, new java.math.BigDecimal("10"), new java.math.BigDecimal("90000"), true, "argos", new co.com.zenvory.inventario.shared.domain.Viewer(true, true, true, null)));
    }

    @Test
    @DisplayName("GET /search y /summary: un gerente no ve otra sucursal aunque la pida")
    void gerente_no_ve_otra_sucursal_aunque_la_pida() throws Exception {
        actAsManagerOfBranch(1L);
        when(purchaseUseCase.search(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(new co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Page(List.of(), 0));
        when(purchaseUseCase.summary(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any()))
                .thenReturn(new co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Summary(1, 2, new java.math.BigDecimal("5"), 3, 4));

        mockMvc.perform(get("/api/v1/purchases/search?branchId=2")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/purchases/summary?branchId=2")).andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(1))
                .andExpect(jsonPath("$.awaitingMe").value(2))
                .andExpect(jsonPath("$.owed").value(5))
                .andExpect(jsonPath("$.owedCount").value(3))
                .andExpect(jsonPath("$.overdue").value(4));

        var criteria = org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Criteria.class);
        org.mockito.Mockito.verify(purchaseUseCase).search(criteria.capture(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean());
        org.assertj.core.api.Assertions.assertThat(criteria.getValue().branchId()).isEqualTo(1L);
        org.assertj.core.api.Assertions.assertThat(criteria.getValue().viewer()).isEqualTo(new co.com.zenvory.inventario.shared.domain.Viewer(false, true, true, 1L));
        org.mockito.Mockito.verify(purchaseUseCase).summary(1L, new co.com.zenvory.inventario.shared.domain.Viewer(false, true, true, 1L));
    }

    @Test
    @DisplayName("GET /search sin parámetros: en curso, primera página, de la más nueva a la más vieja")
    void search_porDefecto() throws Exception {
        when(purchaseUseCase.search(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(new co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Page(List.of(), 0));
        mockMvc.perform(get("/api/v1/purchases/search")).andExpect(status().isOk());
        var criteria = org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort.Criteria.class);
        org.mockito.Mockito.verify(purchaseUseCase).search(criteria.capture(), org.mockito.ArgumentMatchers.eq(new co.com.zenvory.inventario.shared.infrastructure.web.PageParams(0, 25)),
                org.mockito.ArgumentMatchers.eq("id"), org.mockito.ArgumentMatchers.eq(false));
        org.assertj.core.api.Assertions.assertThat(criteria.getValue().status()).isEqualTo("open");
        org.assertj.core.api.Assertions.assertThat(criteria.getValue().text()).isNull();
    }
}
