package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.DuplicateSkuException;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ProductService — Tests unitarios")
class ProductServiceTest {

    @Mock
    private ProductRepositoryPort productRepositoryPort;

    @InjectMocks
    private ProductService productService;

    private Product existingProduct;

    @BeforeEach
    void setUp() {
        existingProduct = Product.builder()
                .id(1L)
                .sku("SKU-001")
                .name("Producto Original")
                .averageCost(new BigDecimal("10.00"))
                .salePrice(new BigDecimal("20.00"))
                .unitId(1L)
                .active(true)
                .build();
    }

    @Test
    @DisplayName("createProduct: lanza DuplicateSkuException si el SKU ya existe")
    void createProduct_throwsDuplicateSkuException() {
        // Arrange
        Product newProduct = Product.builder().sku("SKU-001").build();
        when(productRepositoryPort.existsBySku("SKU-001")).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> productService.createProduct(newProduct))
                .isInstanceOf(DuplicateSkuException.class)
                .hasMessageContaining("SKU-001");
        
        verify(productRepositoryPort, never()).save(any());
    }

    @Test
    @DisplayName("createProduct: guarda el producto si el SKU no existe (y le aplica trim)")
    void createProduct_savesProductWhenSkuIsUnique() {
        // Arrange
        Product newProduct = Product.builder().sku("  SKU-NEW  ").build();
        when(productRepositoryPort.existsBySku("SKU-NEW")).thenReturn(false);
        when(productRepositoryPort.save(any())).thenAnswer(inv -> inv.getArgument(0));

        // Act
        Product result = productService.createProduct(newProduct);

        // Assert
        assertThat(result.getSku()).isEqualTo("SKU-NEW");
        assertThat(result.getActive()).isTrue();
        assertThat(result.getCreatedAt()).isNotNull();
        verify(productRepositoryPort).save(any());
    }

    @Test
    @DisplayName("updateProduct: lanza DuplicateSkuException si el nuevo SKU colisiona con otro")
    void updateProduct_throwsDuplicateSkuException_whenSkuExistsForOtherProduct() {
        // Arrange
        Product updateData = Product.builder().sku("SKU-OTHER").build();
        when(productRepositoryPort.findById(1L)).thenReturn(Optional.of(existingProduct));
        when(productRepositoryPort.existsBySku("SKU-OTHER")).thenReturn(true);

        // Act & Assert
        assertThatThrownBy(() -> productService.updateProduct(1L, updateData))
                .isInstanceOf(DuplicateSkuException.class)
                .hasMessageContaining("SKU-OTHER");
    }

    @Test
    @DisplayName("updateProduct: permite actualizar si el SKU no cambia")
    void updateProduct_allowsUpdate_whenSkuIsSame() {
        // Arrange
        Product updateData = Product.builder()
                .sku("SKU-001")
                .name("Nombre Actualizado")
                .build();
        when(productRepositoryPort.findById(1L)).thenReturn(Optional.of(existingProduct));
        when(productRepositoryPort.save(any())).thenReturn(existingProduct);

        // Act
        Product result = productService.updateProduct(1L, updateData);

        // Assert
        assertThat(result.getName()).isEqualTo("Nombre Actualizado");
        verify(productRepositoryPort, never()).existsBySku(any());
        verify(productRepositoryPort).save(any());
    }

    @Test
    @DisplayName("updateProduct: lanza ProductNotFoundException si el ID no existe")
    void updateProduct_throwsNotFoundException() {
        // Arrange
        when(productRepositoryPort.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> productService.updateProduct(99L, Product.builder().build()))
                .isInstanceOf(ProductNotFoundException.class);
    }
}
