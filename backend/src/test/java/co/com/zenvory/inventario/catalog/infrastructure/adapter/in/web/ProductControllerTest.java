package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.ProductRequest;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ProductController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("ProductController — API Tests")
class ProductControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @MockitoBean
    private ProductUseCase productUseCase;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    private Product sampleProduct;

    @BeforeEach
    void setUp() {
        sampleProduct = Product.builder()
                .id(1L)
                .sku("SKU-001")
                .name("Producto Test")
                .averageCost(new BigDecimal("100.00"))
                .salePrice(new BigDecimal("150.00"))
                .unitId(1L)
                .active(true)
                .createdAt(LocalDateTime.now())
                .build();
    }

    @Test
    @DisplayName("GET /api/catalog/products: returns 200 with product list")
    void getAll_returns200() throws Exception {
        when(productUseCase.getAllProducts()).thenReturn(List.of(sampleProduct));

        mockMvc.perform(get("/api/catalog/products"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sku").value("SKU-001"));
    }

    @Test
    @DisplayName("GET /api/catalog/products/{id}: returns 200 with product")
    void getById_returns200() throws Exception {
        when(productUseCase.getProductById(1L)).thenReturn(sampleProduct);

        mockMvc.perform(get("/api/catalog/products/1"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Producto Test"));
    }

    @Test
    @DisplayName("POST /api/catalog/products: returns 201 with created product")
    void create_returns201() throws Exception {
        ProductRequest request = new ProductRequest("SKU-001", "Producto Test", new BigDecimal("100.00"), new BigDecimal("150.00"), 1L, List.of(), true);
        when(productUseCase.createProduct(any(Product.class))).thenReturn(sampleProduct);

        mockMvc.perform(post("/api/catalog/products")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(1));
    }

    @Test
    @DisplayName("PUT /api/catalog/products/{id}: returns 200 with updated product")
    void update_returns200() throws Exception {
        ProductRequest request = new ProductRequest("SKU-001", "Updated Name", new BigDecimal("100.00"), new BigDecimal("150.00"), 1L, List.of(), true);
        sampleProduct.setName("Updated Name");
        when(productUseCase.updateProduct(eq(1L), any(Product.class))).thenReturn(sampleProduct);

        mockMvc.perform(put("/api/catalog/products/1")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.nombre").value("Updated Name"));
    }

    @Test
    @DisplayName("DELETE /api/catalog/products/{id}: returns 204")
    void delete_returns204() throws Exception {
        mockMvc.perform(delete("/api/catalog/products/1"))
                .andExpect(status().isNoContent());
    }
}
