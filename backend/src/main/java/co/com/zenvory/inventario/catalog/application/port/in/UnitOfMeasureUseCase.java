package co.com.zenvory.inventario.catalog.application.port.in;

import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;

import java.util.List;

/**
 * Puerto de entrada para los casos de uso de Unidades de Medida.
 * Gestiona tanto el catálogo de unidades como su asociación a productos.
 */
public interface UnitOfMeasureUseCase {

    /** Retorna todas las unidades de medida disponibles en el sistema. */
    List<UnitOfMeasure> getAllUnits();

    /**
     * Busca una unidad de medida por ID.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.UnitOfMeasureNotFoundException si no existe.
     */
    UnitOfMeasure getUnitById(Long id);

    /** Crea una nueva unidad de medida. */
    UnitOfMeasure createUnit(UnitOfMeasure unit);

    /**
     * Retorna todas las unidades de medida asociadas a un producto específico,
     * incluyendo su factor de conversión respecto a la unidad base.
     */
    List<ProductUnit> getUnitsByProduct(Long productId);

    /**
     * Asocia una unidad de medida a un producto con su factor de conversión.
     * Si {@code isBase = true}, marca esta como la unidad principal.
     */
    ProductUnit assignUnitToProduct(ProductUnit productUnit);

    /** Actualiza una unidad de medida existente. */
    UnitOfMeasure updateUnit(Long id, UnitOfMeasure unit);

    /** Elimina una unidad de medida por ID. */
    void deleteUnit(Long id);
}
