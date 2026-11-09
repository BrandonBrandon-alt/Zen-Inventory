package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.UnitOfMeasureUseCase;
import co.com.zenvory.inventario.catalog.application.port.out.UnitOfMeasureRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.UnitOfMeasureNotFoundException;
import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * Servicio de aplicación que implementa la orquestación de lógica para unidades de medida.
 * 
 * <p>Gestiona el catálogo central de unidades y las asociaciones de presentaciones 
 * técnicas por producto, incluyendo el cálculo de visualización de nombres y abreviaturas.</p>
 */
@Service
@Transactional
public class UnitOfMeasureService implements UnitOfMeasureUseCase {

    private final UnitOfMeasureRepositoryPort unitRepositoryPort;
    private final ProductRepositoryPort productRepositoryPort;

    /**
     * Constructor para inyección de dependencias.
     * @param unitRepositoryPort Puerto de salida para persistencia de unidades.
     * @param productRepositoryPort Puerto de salida para consultar la unidad base del producto.
     */
    public UnitOfMeasureService(UnitOfMeasureRepositoryPort unitRepositoryPort, ProductRepositoryPort productRepositoryPort) {
        this.unitRepositoryPort = unitRepositoryPort;
        this.productRepositoryPort = productRepositoryPort;
    }

    /** {@inheritDoc} */
    @Override
    public List<UnitOfMeasure> getAllUnits() {
        return unitRepositoryPort.findAll();
    }

    /** 
     * {@inheritDoc} 
     * @throws UnitOfMeasureNotFoundException Si el identificador no corresponde a ninguna unidad.
     */
    @Override
    public UnitOfMeasure getUnitById(Long id) {
        return unitRepositoryPort.findById(id)
                .orElseThrow(() -> new UnitOfMeasureNotFoundException(id));
    }

    /** {@inheritDoc} */
    @Override
    public UnitOfMeasure createUnit(UnitOfMeasure unit) {
        return unitRepositoryPort.save(unit);
    }

    /** 
     * {@inheritDoc} 
     * <p>Enriquece los datos de las asociaciones con el nombre y abreviatura 
     * de la unidad para facilitar el consumo desde el frontal.</p>
     */
    @Override
    public List<ProductUnit> getUnitsByProduct(Long productId) {
        List<ProductUnit> productUnits = unitRepositoryPort.findProductUnitsByProductId(productId);
        productUnits.forEach(pu -> {
            unitRepositoryPort.findById(pu.getUnitId()).ifPresent(u -> {
                pu.setUnitName(u.getName());
                pu.setUnitAbbreviation(u.getAbbreviation());
            });
        });
        return productUnits;
    }

    /** {@inheritDoc} */
    @Override
    public ProductUnit assignUnitToProduct(ProductUnit productUnit) {
        Product product = productRepositoryPort.findById(productUnit.getProductId())
                .orElseThrow(() -> new ProductNotFoundException(productUnit.getProductId()));
        // La unidad base vive en producto.unidad_id; aquí solo van las presentaciones alternas.
        if (productUnit.getUnitId().equals(product.getUnitId())) {
            throw new IllegalArgumentException("Esa unidad ya es la unidad base del producto.");
        }
        // Verificar que la unidad existe antes de asociarla para mantener consistencia
        unitRepositoryPort.findById(productUnit.getUnitId())
                .orElseThrow(() -> new UnitOfMeasureNotFoundException(productUnit.getUnitId()));
        return unitRepositoryPort.saveProductUnit(productUnit);
    }

    /** {@inheritDoc} */
    @Override
    public UnitOfMeasure updateUnit(Long id, UnitOfMeasure unit) {
        UnitOfMeasure existing = getUnitById(id);
        UnitOfMeasure updated = UnitOfMeasure.builder()
                .id(existing.getId())
                .name(unit.getName())
                .abbreviation(unit.getAbbreviation())
                .build();
        return unitRepositoryPort.save(updated);
    }

    /** {@inheritDoc} */
    @Override
    public void deleteUnit(Long id) {
        getUnitById(id); // Verificar existencia previa
        unitRepositoryPort.deleteById(id);
    }

    /** {@inheritDoc} */
    @Override
    public void unassignUnitFromProduct(Long productId, Long unitId) {
        // En el futuro, podríamos validar que el producto existe
        unitRepositoryPort.deleteProductUnit(productId, unitId);
    }
}

