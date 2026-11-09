package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.application.port.out.UnitOfMeasureRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("UnitOfMeasureService — presentaciones de un producto")
class UnitOfMeasureServiceTest {

    private UnitOfMeasureRepositoryPort units;
    private ProductRepositoryPort products;
    private UnitOfMeasureService service;

    @BeforeEach
    void setUp() {
        units = mock(UnitOfMeasureRepositoryPort.class);
        products = mock(ProductRepositoryPort.class);
        service = new UnitOfMeasureService(units, products);
        when(products.findById(1L)).thenReturn(Optional.of(Product.builder().id(1L).unitId(10L).build()));
        when(units.findById(any())).thenReturn(Optional.of(UnitOfMeasure.builder().id(12L).build()));
    }

    private static ProductUnit presentation(Long productId, Long unitId) {
        return ProductUnit.builder().productId(productId).unitId(unitId).conversionFactor(new BigDecimal("12")).build();
    }

    @Test
    @DisplayName("la unidad base del producto no se puede agregar como presentación: ya vive en producto.unidad_id")
    void baseUnitRejected() {
        assertThatThrownBy(() -> service.assignUnitToProduct(presentation(1L, 10L))).isInstanceOf(IllegalArgumentException.class);
        verify(units, never()).saveProductUnit(any());
    }

    @Test
    @DisplayName("una unidad distinta de la base se guarda")
    void otherUnitSaved() {
        ProductUnit box = presentation(1L, 12L);
        service.assignUnitToProduct(box);
        verify(units).saveProductUnit(box);
    }

    @Test
    @DisplayName("un producto que no existe responde 404, no un error de clave foránea")
    void unknownProductRejected() {
        when(products.findById(99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.assignUnitToProduct(presentation(99L, 12L))).isInstanceOf(ProductNotFoundException.class);
        verify(units, never()).saveProductUnit(any());
    }
}
