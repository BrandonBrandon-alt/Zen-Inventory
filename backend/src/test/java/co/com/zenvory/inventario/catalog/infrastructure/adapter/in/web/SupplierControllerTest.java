package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.catalog.application.port.in.SupplierUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.SupplierRequest;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
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

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(SupplierController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("SupplierController — API Tests")
class SupplierControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private SupplierUseCase supplierUseCase;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    private Supplier sampleSupplier;

    @BeforeEach
    void setUp() {
        sampleSupplier = Supplier.builder()
                .id(1L)
                .name("Proveedor Test")
                .contact("Contacto Test")
                .deliveryDays(5)
                .build();
    }

    @Test
    @DisplayName("GET /api/catalog/suppliers: returns 200")
    void getAll_returns200() throws Exception {
        when(supplierUseCase.getAllSuppliers()).thenReturn(List.of(sampleSupplier));

        mockMvc.perform(get("/api/catalog/suppliers"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].nombre").value("Proveedor Test"));
    }

    @Test
    @DisplayName("GET /api/catalog/suppliers/{id}: returns 200")
    void getById_returns200() throws Exception {
        when(supplierUseCase.getSupplierById(1L)).thenReturn(sampleSupplier);

        mockMvc.perform(get("/api/catalog/suppliers/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Proveedor Test"));
    }

    @Test
    @DisplayName("POST /api/catalog/suppliers: returns 201")
    void create_returns201() throws Exception {
        SupplierRequest request = new SupplierRequest("Nuevo Proveedor", "Contacto", 3);
        when(supplierUseCase.createSupplier(any(Supplier.class))).thenReturn(sampleSupplier);

        mockMvc.perform(post("/api/catalog/suppliers")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated());
    }

    @Test
    @DisplayName("GET /api/catalog/suppliers/search: returns 200")
    void search_returns200() throws Exception {
        when(supplierUseCase.getSuppliersByProductId(1L)).thenReturn(List.of(sampleSupplier));

        mockMvc.perform(get("/api/catalog/suppliers/search?productId=1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));
    }
}
