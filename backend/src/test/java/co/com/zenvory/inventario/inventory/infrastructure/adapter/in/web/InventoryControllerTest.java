package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
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

import java.math.BigDecimal;
import java.util.Optional;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(InventoryController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("InventoryController — API Tests")
class InventoryControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private InventoryUseCase inventoryUseCase;

    @MockitoBean
    private ProductUseCase productUseCase;

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
    @DisplayName("GET /api/v1/inventory/branches/1/products/1: returns 200")
    void getInventory_returns200() throws Exception {
        LocalInventory inventory = LocalInventory.builder()
                .id(1L)
                .branchId(1L)
                .productId(1L)
                .currentQuantity(new BigDecimal("100"))
                .build();
        when(inventoryUseCase.getInventory(1L, 1L)).thenReturn(inventory);

        mockMvc.perform(get("/api/v1/inventory/branches/1/products/1"))
                .andExpect(status().isOk());
    }

    @Test
    @DisplayName("GET /api/v1/inventory/movements: returns 200")
    void getMovements_returns200() throws Exception {
        mockMvc.perform(get("/api/v1/inventory/movements"))
                .andExpect(status().isOk());
    }

    private void actAsManagerOfBranch(Long branchId) {
        co.com.zenvory.inventario.auth.domain.model.User manager = co.com.zenvory.inventario.auth.domain.model.User.builder()
                .id(5L).email("test@example.com").nombre("Gerente").sucursalId(branchId)
                .role(co.com.zenvory.inventario.auth.domain.model.Role.builder().nombre("MANAGER").build()).build();
        org.mockito.Mockito.when(userRepositoryPort.findByEmail("test@example.com")).thenReturn(java.util.Optional.of(manager));
    }

    @Test
    @DisplayName("retirar o ingresar stock en otra sucursal es 403 y no toca el inventario")
    void stockMovementsOtherBranch_return403() throws Exception {
        actAsManagerOfBranch(1L);
        String body = "{\"quantity\": 1, \"reason\": \"MERMA\", \"userId\": 99}";
        mockMvc.perform(post("/api/v1/inventory/branches/2/products/3/withdraw").contentType("application/json").content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(post("/api/v1/inventory/branches/2/products/3/add").contentType("application/json").content(body))
                .andExpect(status().isForbidden());
        mockMvc.perform(put("/api/v1/inventory/branches/2/products/3/config?minimumStock=5")).andExpect(status().isForbidden());
        mockMvc.perform(get("/api/v1/inventory/branches/2/products/3/kardex")).andExpect(status().isForbidden());
        org.mockito.Mockito.verifyNoInteractions(inventoryUseCase);
    }

    @Test
    @DisplayName("el movimiento queda a nombre del usuario de la sesión, no del userId del cuerpo")
    void movementAuthorIsSessionUser() throws Exception {
        actAsManagerOfBranch(1L);
        String body = "{\"quantity\": 1, \"reason\": \"MERMA\", \"userId\": 99}";
        when(productUseCase.getProductById(3L)).thenReturn(co.com.zenvory.inventario.catalog.domain.model.Product.builder().name("P").build());
        mockMvc.perform(post("/api/v1/inventory/branches/1/products/3/withdraw").contentType("application/json").content(body))
                .andExpect(status().isNoContent());
        org.mockito.Mockito.verify(inventoryUseCase).withdrawStock(org.mockito.ArgumentMatchers.eq(1L), org.mockito.ArgumentMatchers.eq(3L),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.eq(5L), org.mockito.ArgumentMatchers.any(),
                org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any(), org.mockito.ArgumentMatchers.any());
    }

    @Test
    @DisplayName("el listado enriquecido (con costo y precio) de otra sucursal es 403, pero el stock de UN producto en otra sucursal se puede consultar (traslados)")
    void listIsOwnBranchOnlyButSingleProductReadIsOpen() throws Exception {
        actAsManagerOfBranch(1L);
        mockMvc.perform(get("/api/v1/inventory/branches/2")).andExpect(status().isForbidden());
        org.mockito.Mockito.verify(inventoryUseCase, org.mockito.Mockito.never()).getEnrichedInventoryByBranch(org.mockito.ArgumentMatchers.any());

        when(inventoryUseCase.getInventory(2L, 3L)).thenReturn(
                co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().branchId(2L).productId(3L)
                        .currentQuantity(java.math.BigDecimal.TEN).build());
        mockMvc.perform(get("/api/v1/inventory/branches/2/products/3")).andExpect(status().isOk());
        when(inventoryUseCase.getEnrichedInventoryByBranch(1L)).thenReturn(java.util.List.of());
        mockMvc.perform(get("/api/v1/inventory/branches/1")).andExpect(status().isOk());
    }

    @Test
    @DisplayName("un stock mínimo negativo por la API es 400")
    void negativeMinimumIs400() throws Exception {
        actAsManagerOfBranch(1L);
        mockMvc.perform(put("/api/v1/inventory/branches/1/products/3/config?minimumStock=-2")).andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("los movimientos de un MANAGER sin sucursal asignada son 403, no una consulta con null")
    void movementsWithoutBranchIs403() throws Exception {
        actAsManagerOfBranch(null);
        mockMvc.perform(get("/api/v1/inventory/movements")).andExpect(status().isForbidden());
    }
}
