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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
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
        when(transfer.freightPaymentStatus()).thenReturn(co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus.SIN_COSTO);
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
        when(transfer.freightPaymentStatus()).thenReturn(co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus.SIN_COSTO);
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

    private Transfer mockForFreight() {
        Transfer transfer = mock(Transfer.class);
        when(transfer.getStatus()).thenReturn(co.com.zenvory.inventario.transfer.domain.model.TransferStatus.IN_TRANSIT);
        when(transfer.getDetails()).thenReturn(List.of());
        when(transfer.getPayments()).thenReturn(List.of());
        when(transfer.freightPaymentStatus()).thenReturn(co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus.PAGO_PARCIAL);
        return transfer;
    }

    @Test
    @DisplayName("POST /transfers/{id}/pay-freight: registra el abono con su monto, método y referencia")
    void payFreight_forwardsPayment() throws Exception {
        Transfer transfer = mockForFreight();
        when(transferUseCase.registerFreightPayment(eq(4L), any(), any(), any(), any())).thenReturn(transfer);

        mockMvc.perform(post("/api/v1/transfers/4/pay-freight")
                .contentType(MediaType.APPLICATION_JSON)
                .content("{\"amount\":150000.50,\"method\":\"TRANSFERENCIA\",\"reference\":\"TR-9\",\"notes\":\"abono\"}"))
                .andExpect(status().isOk());

        verify(transferUseCase).registerFreightPayment(4L, new java.math.BigDecimal("150000.50"),
                co.com.zenvory.inventario.transfer.domain.model.TransferPaymentMethod.TRANSFERENCIA, "TR-9", "abono");
    }

    @Test
    @DisplayName("POST /transfers/{id}/pay-freight sin cuerpo paga todo el saldo")
    void payFreight_withoutBody() throws Exception {
        Transfer transfer = mockForFreight();
        when(transferUseCase.registerFreightPayment(eq(4L), isNull(), isNull(), isNull(), isNull())).thenReturn(transfer);
        mockMvc.perform(post("/api/v1/transfers/4/pay-freight")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("POST /transfers/{id}/pay-freight: monto en cero o negativo es 400 y no registra nada")
    void payFreight_rejectsInvalidAmount() throws Exception {
        mockMvc.perform(post("/api/v1/transfers/4/pay-freight").contentType(MediaType.APPLICATION_JSON).content("{\"amount\":0}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(post("/api/v1/transfers/4/pay-freight").contentType(MediaType.APPLICATION_JSON).content("{\"amount\":-5}"))
                .andExpect(status().isBadRequest());
        verify(transferUseCase, never()).registerFreightPayment(any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("POST /transfers/{id}/freight-payments/{paymentId}/void: anula el pago con el motivo")
    void voidFreightPayment_forwardsReason() throws Exception {
        Transfer transfer = mockForFreight();
        when(transferUseCase.voidFreightPayment(4L, 2L, "Duplicado")).thenReturn(transfer);
        mockMvc.perform(post("/api/v1/transfers/4/freight-payments/2/void").contentType(MediaType.APPLICATION_JSON).content("{\"reason\":\"Duplicado\"}"))
                .andExpect(status().isOk());
        verify(transferUseCase).voidFreightPayment(4L, 2L, "Duplicado");
    }

    @Test
    @DisplayName("anular un pago del flete sin motivo es 400")
    void voidFreightPayment_requiresReason() throws Exception {
        mockMvc.perform(post("/api/v1/transfers/4/freight-payments/2/void").contentType(MediaType.APPLICATION_JSON).content("{}"))
                .andExpect(status().isBadRequest());
        verify(transferUseCase, org.mockito.Mockito.never()).voidFreightPayment(any(), any(), any());
    }

    private void actAsManagerOf(Long branchId) {
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(Optional.of(User.builder().id(5L).email("test@example.com").nombre("Gerente")
                .sucursalId(branchId).role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("MANAGER").build()).build()));
    }

    @Test
    @DisplayName("GET /search: los parámetros llegan al criterio, con quién mira, y responde la página")
    void search_pasaLosParametros() throws Exception {
        var row = new co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Row(7L,
                co.com.zenvory.inventario.transfer.domain.model.TransferStatus.IN_TRANSIT, co.com.zenvory.inventario.transfer.domain.model.TransferPriority.HIGH,
                1L, "Central", 2L, "Norte", "Cemento", 3, co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus.PAGO_PARCIAL,
                new java.math.BigDecimal("30000"), java.time.LocalDateTime.of(2026, 10, 11, 9, 0), true);
        when(transferUseCase.search(any(), any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(new co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Page(java.util.List.of(row), 30));

        mockMvc.perform(get("/api/v1/transfers/search?page=1&size=25&sortBy=route&direction=asc&status=IN_TRANSIT&flow=incoming&priority=HIGH"
                        + "&from=2026-10-01&to=2026-10-31&originId=1&destinationId=2&productId=3&onlyMine=true").param("q", " cemento "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(7))
                .andExpect(jsonPath("$.content[0].originName").value("Central"))
                .andExpect(jsonPath("$.content[0].firstProductName").value("Cemento"))
                .andExpect(jsonPath("$.content[0].productCount").value(3))
                .andExpect(jsonPath("$.content[0].freightStatus").value("PAGO_PARCIAL"))
                .andExpect(jsonPath("$.content[0].awaitsMe").value(true))
                .andExpect(jsonPath("$.totalPages").value(2));

        var criteria = org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Criteria.class);
        verify(transferUseCase).search(criteria.capture(), eq(new co.com.zenvory.inventario.shared.infrastructure.web.PageParams(1, 25)), eq("route"), eq(true));
        org.assertj.core.api.Assertions.assertThat(criteria.getValue()).isEqualTo(new co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Criteria(
                "IN_TRANSIT", "incoming", co.com.zenvory.inventario.transfer.domain.model.TransferPriority.HIGH, java.time.LocalDate.of(2026, 10, 1), java.time.LocalDate.of(2026, 10, 31),
                1L, 2L, 3L, true, "cemento", new co.com.zenvory.inventario.shared.domain.Viewer(true, true, true, null)));
    }

    @Test
    @DisplayName("GET /search y /summary: un gerente ve con su sucursal (no otra) y sin sucursal asignada recibe 403")
    void gerente_no_ve_traslados_de_otras_sucursales() throws Exception {
        actAsManagerOf(4L);
        when(transferUseCase.search(any(), any(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(new co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Page(java.util.List.of(), 0));
        when(transferUseCase.summary(any())).thenReturn(new co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Summary(1, 2, new java.math.BigDecimal("5"), 3));

        mockMvc.perform(get("/api/v1/transfers/search")).andExpect(status().isOk());
        mockMvc.perform(get("/api/v1/transfers/summary")).andExpect(status().isOk())
                .andExpect(jsonPath("$.open").value(1))
                .andExpect(jsonPath("$.awaitingMe").value(2))
                .andExpect(jsonPath("$.freightOwed").value(5))
                .andExpect(jsonPath("$.freightOwedCount").value(3));

        var viewer = new co.com.zenvory.inventario.shared.domain.Viewer(false, true, true, 4L);
        var criteria = org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort.Criteria.class);
        verify(transferUseCase).search(criteria.capture(), any(), eq("id"), eq(false));
        org.assertj.core.api.Assertions.assertThat(criteria.getValue().viewer()).isEqualTo(viewer);
        org.assertj.core.api.Assertions.assertThat(criteria.getValue().status()).isEqualTo("open");
        verify(transferUseCase).summary(viewer);

        actAsManagerOf(null);
        mockMvc.perform(get("/api/v1/transfers/search")).andExpect(status().isForbidden());
    }
}
