package co.com.zenvory.inventario.catalog.application.port.in;

import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;

import java.util.List;

/**
 * Puerto de entrada (Input Port) que define las operaciones de negocio para la gestión de unidades de medida.
 * 
 * <p>Gestiona tanto el nomenclador maestro de unidades como las presentaciones 
 * técnicas asociadas a los productos (presentaciones y factores de conversión).</p>
 */
public interface UnitOfMeasureUseCase {

    /**
     * Recupera el listado completo de unidades de medida globales.
     * 
     * @return Lista de modelos de dominio {@link UnitOfMeasure}.
     */
    List<UnitOfMeasure> getAllUnits();

    /**
     * Busca una unidad de medida por su identificador único.
     * 
     * @param id Identificador primario.
     * @return Modelo de la unidad de medida.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.UnitOfMeasureNotFoundException si no existe.
     */
    UnitOfMeasure getUnitById(Long id);

    /**
     * Registra una nueva unidad de medida en el catálogo maestro.
     * 
     * @param unit Datos de la nueva unidad.
     * @return La unidad creada con ID asignado.
     */
    UnitOfMeasure createUnit(UnitOfMeasure unit);

    /**
     * Obtiene todas las asociaciones de unidades de medida configuradas para un producto.
     * 
     * @param productId ID del producto de referencia.
     * @return Lista de asociaciones {@link ProductUnit} con sus factores de conversión.
     */
    List<ProductUnit> getUnitsByProduct(Long productId);

    /**
     * Establece una nueva relación entre un producto y una unidad de medida.
     * 
     * @param productUnit Datos de la relación (factor de conversión y flag de base).
     * @return La asociación persistida.
     */
    ProductUnit assignUnitToProduct(ProductUnit productUnit);

    /**
     * Actualiza los datos de una unidad de medida existente en el catálogo.
     * 
     * @param id ID de la unidad a modificar.
     * @param unit Nuevos datos.
     * @return La unidad actualizada.
     */
    UnitOfMeasure updateUnit(Long id, UnitOfMeasure unit);

    /**
     * Elimina una unidad de medida del catálogo maestro.
     * 
     * @param id ID de la unidad a retirar.
     */
    void deleteUnit(Long id);

    /**
     * Elimina la asociación de una unidad de medida con un producto.
     * 
     * @param productId ID del producto.
     * @param unitId ID de la unidad.
     */
    void unassignUnitFromProduct(Long productId, Long unitId);
}

