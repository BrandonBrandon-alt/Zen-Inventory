package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.inventory.application.port.in.MovementAuditUseCase;
import co.com.zenvory.inventario.inventory.application.port.out.MovementPage;
import co.com.zenvory.inventario.inventory.application.port.out.MovementRecord;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MovementAuditController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("MovementAuditController — auditoría paginada")
class MovementAuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private MovementAuditUseCase audit;

    @MockitoBean
    private UserRepositoryPort userRepositoryPort;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    private static final MovementRecord RECORD = new MovementRecord(
            InventoryMovement.builder().id(9L).type(MovementType.RETIRO).reason(MovementReason.VENTA).quantity(new BigDecimal("3"))
                    .date(LocalDateTime.of(2026, 10, 12, 9, 0)).productId(1L).branchId(2L).userId(4L).referenceType("VENTA").referenceId(41L)
                    .finalBalance(new BigDecimal("97")).build(),
            "Cemento Gris 50Kg", "Sucursal Norte", "Ana Gómez");

    @BeforeEach
    void setUp() {
        Authentication auth = mock(Authentication.class);
        when(auth.getName()).thenReturn("test@example.com");
        SecurityContext context = mock(SecurityContext.class);
        when(context.getAuthentication()).thenReturn(auth);
        SecurityContextHolder.setContext(context);
        when(audit.search(any(), anyInt(), anyInt(), anyString(), anyBoolean()))
                .thenReturn(new MovementPage(List.of(RECORD), 51, new BigDecimal("120"), new BigDecimal("30")));
    }

    private void actAs(String role, Long branchId) {
        User user = User.builder().id(1L).email("test@example.com").nombre("Yo").sucursalId(branchId).role(Role.builder().nombre(role).build()).build();
        when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(Optional.of(user));
    }

    @Test
    @DisplayName("devuelve la página con los nombres, el total de páginas y lo que entró y salió")
    void returnsPageWithNamesAndTotals() throws Exception {
        actAs("ADMIN", null);
        mockMvc.perform(get("/api/v1/inventory/movements/search?page=2&size=25"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].id").value(9))
                .andExpect(jsonPath("$.content[0].productName").value("Cemento Gris 50Kg"))
                .andExpect(jsonPath("$.content[0].branchName").value("Sucursal Norte"))
                .andExpect(jsonPath("$.content[0].userName").value("Ana Gómez"))
                .andExpect(jsonPath("$.totalElements").value(51))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.totalIn").value(120))
                .andExpect(jsonPath("$.totalOut").value(30));
    }

    @Test
    @DisplayName("el ADMIN filtra por la sucursal que pide y los filtros llegan al caso de uso")
    void admin_choosesBranchAndFiltersArePassed() throws Exception {
        actAs("ADMIN", null);
        mockMvc.perform(get("/api/v1/inventory/movements/search?branchId=2&type=RETIRO&reason=VENTA&from=2026-10-01&to=2026-10-31"
                        + "&productId=1&userId=4&minQuantity=2&maxQuantity=9&onlyObserved=true&sortBy=quantity&direction=asc").param("q", "  venta "))
                .andExpect(status().isOk());

        ArgumentCaptor<MovementSearchCriteria> criteria = ArgumentCaptor.forClass(MovementSearchCriteria.class);
        verify(audit).search(criteria.capture(), eq(0), eq(25), eq("quantity"), eq(true));
        assertThat(criteria.getValue()).isEqualTo(new MovementSearchCriteria(2L, MovementType.RETIRO, List.of(MovementReason.VENTA),
                LocalDate.of(2026, 10, 1), LocalDate.of(2026, 10, 31), List.of(1L), 4L, new BigDecimal("2"), new BigDecimal("9"), true, "venta"));
    }

    @Test
    @DisplayName("varios productos y varios motivos llegan como listas")
    void variosProductosYMotivos() throws Exception {
        actAs("ADMIN", null);
        mockMvc.perform(get("/api/v1/inventory/movements/search?productId=1&productId=3&reason=VENTA&reason=MERMA")).andExpect(status().isOk());

        ArgumentCaptor<MovementSearchCriteria> criteria = ArgumentCaptor.forClass(MovementSearchCriteria.class);
        verify(audit).search(criteria.capture(), anyInt(), anyInt(), anyString(), anyBoolean());
        assertThat(criteria.getValue().productIds()).containsExactly(1L, 3L);
        assertThat(criteria.getValue().reasons()).containsExactly(MovementReason.VENTA, MovementReason.MERMA);
    }

    @Test
    @DisplayName("un gerente solo ve su sucursal aunque pida otra")
    void manager_isLimitedToOwnBranch() throws Exception {
        actAs("MANAGER", 5L);
        mockMvc.perform(get("/api/v1/inventory/movements/search?branchId=2")).andExpect(status().isOk());

        ArgumentCaptor<MovementSearchCriteria> criteria = ArgumentCaptor.forClass(MovementSearchCriteria.class);
        verify(audit).search(criteria.capture(), anyInt(), anyInt(), anyString(), anyBoolean());
        assertThat(criteria.getValue().branchId()).isEqualTo(5L);
    }

    @Test
    @DisplayName("un gerente sin sucursal asignada recibe 403, no una consulta sin filtro de sucursal")
    void managerWithoutBranch_is403() throws Exception {
        actAs("MANAGER", null);
        mockMvc.perform(get("/api/v1/inventory/movements/search")).andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("exportar devuelve la lista filtrada sin paginar")
    void export_returnsList() throws Exception {
        actAs("ADMIN", null);
        when(audit.export(any(), anyString(), anyBoolean())).thenReturn(List.of(RECORD, RECORD));
        mockMvc.perform(get("/api/v1/inventory/movements/export?reason=VENTA"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].productName").value("Cemento Gris 50Kg"));
    }

    @Test
    @DisplayName("solo ADMIN, MANAGER y OPERADOR consultan la auditoría (el vendedor no)")
    void roles() throws Exception {
        for (String method : List.of("search", "export")) {
            var annotation = java.util.Arrays.stream(MovementAuditController.class.getMethods())
                    .filter(m -> m.getName().equals(method)).findFirst().orElseThrow().getAnnotation(PreAuthorize.class);
            assertThat(annotation.value()).isEqualTo("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')");
        }
    }
}
