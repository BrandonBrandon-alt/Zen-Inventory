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
}

