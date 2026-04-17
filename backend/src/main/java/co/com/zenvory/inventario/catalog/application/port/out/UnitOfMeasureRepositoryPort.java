package co.com.zenvory.inventario.catalog.application.port.out;

import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida para la persistencia de Unidades de Medida
 * y sus relaciones con los productos (tabla {@code producto_unidad}).
 */
public interface UnitOfMeasureRepositoryPort {

    List<UnitOfMeasure> findAll();

    Optional<UnitOfMeasure> findById(Long id);

    UnitOfMeasure save(UnitOfMeasure unit);

    void deleteById(Long id);

    /** Devuelve todas las unidades asignadas a un producto con sus factores. */
    List<ProductUnit> findProductUnitsByProductId(Long productId);

    /** Persiste la relación producto-unidad. */
    ProductUnit saveProductUnit(ProductUnit productUnit);
}
