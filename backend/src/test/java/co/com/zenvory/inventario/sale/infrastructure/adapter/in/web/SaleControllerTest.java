package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.sale.application.port.in.CreateSaleUseCase;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.domain.model.Sale;
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

@WebMvcTest(SaleController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("SaleController — API Tests")
class SaleControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CreateSaleUseCase createSaleUseCase;

    @MockitoBean
    private SaleManagementUseCase saleManagementUseCase;

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
    @DisplayName("GET /api/v1/sales: returns 200")
    void getAll_returns200() throws Exception {
        Sale sale = mock(Sale.class);
        when(sale.getStatus()).thenReturn(co.com.zenvory.inventario.sale.domain.model.SaleStatus.COMPLETED);
        when(sale.getDetails()).thenReturn(List.of());
        when(saleManagementUseCase.getAllSales()).thenReturn(List.of(sale));

        mockMvc.perform(get("/api/v1/sales"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/v1/sales/{id}: returns 200")
    void getById_returns200() throws Exception {
        Sale sale = mock(Sale.class);
        when(sale.getStatus()).thenReturn(co.com.zenvory.inventario.sale.domain.model.SaleStatus.COMPLETED);
        when(sale.getDetails()).thenReturn(List.of());
        when(saleManagementUseCase.getSaleById(1L)).thenReturn(sale);

        mockMvc.perform(get("/api/v1/sales/1"))
                .andExpect(status().isOk());
    }


    @Test
    @DisplayName("DELETE /api/v1/sales/{id}: returns 204")
    void cancel_returns204() throws Exception {
        mockMvc.perform(delete("/api/v1/sales/1?reason=Test"))
                .andExpect(status().isNoContent());
    }

    private void actAsManagerOfBranch(Long branchId) {
        co.com.zenvory.inventario.auth.domain.model.User manager = co.com.zenvory.inventario.auth.domain.model.User.builder()
                .id(5L).email("test@example.com").nombre("Gerente").sucursalId(branchId)
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("MANAGER").build()).build();
        org.mockito.Mockito.when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(java.util.Optional.of(manager));
    }

    private static final String SALE_BODY = "{\"branchId\": %d, \"userId\": 99, \"items\": [{\"productId\": 1, \"quantity\": 1}]}";

    @Test
    @DisplayName("POST /sales: el vendedor y la sucursal salen de la sesión, no del cuerpo (userId falso se ignora)")
    void create_usesSessionIdentity() throws Exception {
        actAsManagerOfBranch(1L);
        Sale sale = mock(Sale.class);
        when(sale.getStatus()).thenReturn(co.com.zenvory.inventario.sale.domain.model.SaleStatus.COMPLETED);
        when(sale.getDetails()).thenReturn(List.of());
        when(createSaleUseCase.execute(org.mockito.ArgumentMatchers.any())).thenReturn(sale);

        mockMvc.perform(post("/api/v1/sales").contentType("application/json").content(String.format(SALE_BODY, 1)))
                .andExpect(status().isCreated());

        org.mockito.ArgumentCaptor<co.com.zenvory.inventario.sale.application.port.in.CreateSaleCommand> captor =
                org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.sale.application.port.in.CreateSaleCommand.class);
        org.mockito.Mockito.verify(createSaleUseCase).execute(captor.capture());
        org.assertj.core.api.Assertions.assertThat(captor.getValue().userId()).isEqualTo(5L);
        org.assertj.core.api.Assertions.assertThat(captor.getValue().branchId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("POST /sales: vender a nombre de otra sucursal es 403 y no registra nada")
    void create_otherBranch_returns403() throws Exception {
        actAsManagerOfBranch(1L);
        mockMvc.perform(post("/api/v1/sales").contentType("application/json").content(String.format(SALE_BODY, 2)))
                .andExpect(status().isForbidden());
        org.mockito.Mockito.verify(createSaleUseCase, org.mockito.Mockito.never()).execute(org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("GET /sales/{id}: una venta de otra sucursal es 403")
    void getById_otherBranch_returns403() throws Exception {
        actAsManagerOfBranch(1L);
        Sale sale = mock(Sale.class);
        when(sale.getBranchId()).thenReturn(2L);
        when(saleManagementUseCase.getSaleById(1L)).thenReturn(sale);
        mockMvc.perform(get("/api/v1/sales/1")).andExpect(status().isForbidden());
    }

    private static co.com.zenvory.inventario.sale.application.port.out.SalePage emptyPage() {
        return new co.com.zenvory.inventario.sale.application.port.out.SalePage(List.of(), 0, 0, java.math.BigDecimal.ZERO);
    }

    private co.com.zenvory.inventario.sale.application.port.out.SaleSearchCriteria searchedCriteria(int size) {
        org.mockito.ArgumentCaptor<co.com.zenvory.inventario.sale.application.port.out.SaleSearchCriteria> captor =
                org.mockito.ArgumentCaptor.forClass(co.com.zenvory.inventario.sale.application.port.out.SaleSearchCriteria.class);
        org.mockito.Mockito.verify(saleManagementUseCase).searchSales(
                captor.capture(), org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.eq(size),
                org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean());
        return captor.getValue();
    }

    @Test
    @DisplayName("GET /sales/search: devuelve la página con el total y el resumen de todo lo filtrado")
    void search_returnsPageWithSummary() throws Exception {
        Sale sale = mock(Sale.class);
        when(sale.getStatus()).thenReturn(co.com.zenvory.inventario.sale.domain.model.SaleStatus.COMPLETED);
        when(sale.getDetails()).thenReturn(List.of());
        when(saleManagementUseCase.searchSales(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(2),
                org.mockito.ArgumentMatchers.eq(10), org.mockito.ArgumentMatchers.eq("total"), org.mockito.ArgumentMatchers.eq(true)))
                .thenReturn(new co.com.zenvory.inventario.sale.application.port.out.SalePage(List.of(sale), 25, 20, new java.math.BigDecimal("1500.50")));

        mockMvc.perform(get("/api/v1/sales/search?page=2&size=10&sortBy=total&direction=asc"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content.length()").value(1))
                .andExpect(jsonPath("$.totalElements").value(25))
                .andExpect(jsonPath("$.totalPages").value(3))
                .andExpect(jsonPath("$.page").value(2))
                .andExpect(jsonPath("$.completedCount").value(20))
                .andExpect(jsonPath("$.completedTotal").value(1500.50));
    }

    @Test
    @DisplayName("GET /sales/search: pasa los filtros al caso de uso (ADMIN puede elegir sucursal)")
    void search_forwardsFilters() throws Exception {
        when(saleManagementUseCase.searchSales(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(emptyPage());

        mockMvc.perform(get("/api/v1/sales/search?branchId=3&status=CANCELED&from=2026-01-01&to=2026-01-31&seller=Ana&product=Cafe&minTotal=10&maxTotal=99.5&q=perez"))
                .andExpect(status().isOk());

        var c = searchedCriteria(10);
        org.assertj.core.api.Assertions.assertThat(c.branchId()).isEqualTo(3L);
        org.assertj.core.api.Assertions.assertThat(c.status()).isEqualTo(co.com.zenvory.inventario.sale.domain.model.SaleStatus.CANCELED);
        org.assertj.core.api.Assertions.assertThat(c.from()).isEqualTo(java.time.LocalDate.of(2026, 1, 1));
        org.assertj.core.api.Assertions.assertThat(c.to()).isEqualTo(java.time.LocalDate.of(2026, 1, 31));
        org.assertj.core.api.Assertions.assertThat(c.seller()).isEqualTo("Ana");
        org.assertj.core.api.Assertions.assertThat(c.product()).isEqualTo("Cafe");
        org.assertj.core.api.Assertions.assertThat(c.minTotal()).isEqualByComparingTo("10");
        org.assertj.core.api.Assertions.assertThat(c.maxTotal()).isEqualByComparingTo("99.5");
        org.assertj.core.api.Assertions.assertThat(c.text()).isEqualTo("perez");
    }

    @Test
    @DisplayName("GET /sales/search: quien no es ADMIN solo ve su sucursal, aunque pida otra")
    void search_nonAdmin_isRestrictedToOwnBranch() throws Exception {
        actAsManagerOfBranch(1L);
        when(saleManagementUseCase.searchSales(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(emptyPage());

        mockMvc.perform(get("/api/v1/sales/search?branchId=2")).andExpect(status().isOk());

        org.assertj.core.api.Assertions.assertThat(searchedCriteria(10).branchId()).isEqualTo(1L);
    }

    @Test
    @DisplayName("GET /sales/search: el tamaño de página tiene tope y la página no es negativa")
    void search_clampsPageSize() throws Exception {
        when(saleManagementUseCase.searchSales(org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.anyInt(),
                org.mockito.ArgumentMatchers.anyInt(), org.mockito.ArgumentMatchers.anyString(), org.mockito.ArgumentMatchers.anyBoolean()))
                .thenReturn(emptyPage());

        mockMvc.perform(get("/api/v1/sales/search?page=-4&size=100000")).andExpect(status().isOk());

        org.mockito.Mockito.verify(saleManagementUseCase).searchSales(
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(0), org.mockito.ArgumentMatchers.eq(100),
                org.mockito.ArgumentMatchers.eq("id"), org.mockito.ArgumentMatchers.eq(false));
    }

    @Test
    @DisplayName("GET /sales/filter-options: devuelve vendedores y productos")
    void filterOptions_returnsLists() throws Exception {
        when(saleManagementUseCase.getFilterOptions(null))
                .thenReturn(new co.com.zenvory.inventario.sale.application.port.out.SaleFilterOptions(List.of("Ana"), List.of("Cafe", "Te")));

        mockMvc.perform(get("/api/v1/sales/filter-options"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sellers[0]").value("Ana"))
                .andExpect(jsonPath("$.products.length()").value(2));
    }
}
