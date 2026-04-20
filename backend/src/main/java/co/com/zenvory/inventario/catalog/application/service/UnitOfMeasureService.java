package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.UnitOfMeasureUseCase;
import co.com.zenvory.inventario.catalog.application.port.out.UnitOfMeasureRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.UnitOfMeasureNotFoundException;
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

    /**
     * Constructor para inyección de dependencias.
     * @param unitRepositoryPort Puerto de salida para persistencia de unidades.
     */
    public UnitOfMeasureService(UnitOfMeasureRepositoryPort unitRepositoryPort) {
        this.unitRepositoryPort = unitRepositoryPort;
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

