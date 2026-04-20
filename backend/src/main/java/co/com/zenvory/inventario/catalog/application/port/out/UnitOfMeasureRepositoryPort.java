package co.com.zenvory.inventario.catalog.application.port.out;

import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) que define el contrato de persistencia para unidades de medida.
 * 
 * <p>Gestiona tanto el catálogo central de unidades como las relaciones de conversión 
 * específicas de cada producto.</p>
 */
public interface UnitOfMeasureRepositoryPort {

    /**
     * Recupera todas las unidades de medida registradas en el catálogo.
     * 
     * @return Lista de unidades.
     */
    List<UnitOfMeasure> findAll();

    /**
     * Busca una unidad de medida por su identificador primario.
     * 
     * @param id ID de la unidad.
     * @return {@link Optional} con la unidad si existe.
     */
    Optional<UnitOfMeasure> findById(Long id);

    /**
     * Persiste o actualiza una unidad de medida en el catálogo global.
     * 
     * @param unit Modelo de dominio a guardar.
     * @return La unidad persistida.
     */
    UnitOfMeasure save(UnitOfMeasure unit);

    /**
     * Elimina una unidad de medida del catálogo global.
     * 
     * @param id Identificador a eliminar.
     */
    void deleteById(Long id);

    /** 
     * Obtiene las presentaciones y factores de conversión configurados para un producto.
     * 
     * @param productId ID del producto.
     * @return Lista de asociaciones {@link ProductUnit}.
     */
    List<ProductUnit> findProductUnitsByProductId(Long productId);

    /** 
     * Persiste la relación comercial/técnica entre un producto y una unidad.
     * 
     * @param productUnit Datos de la asociación.
     * @return La asociación persistida.
     */
    ProductUnit saveProductUnit(ProductUnit productUnit);
}

