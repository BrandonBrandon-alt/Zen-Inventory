package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.UnitOfMeasureRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (Secondary Adapter) para la persistencia de unidades de medida.
 * 
 * <p>Implementa {@link UnitOfMeasureRepositoryPort} utilizando repositorios JPA.
 * Gestiona de manera centralizada el catálogo de unidades y las configuraciones 
 * de empaque o presentación vinculadas a los productos.</p>
 */
@Component
public class UnitOfMeasurePersistenceAdapter implements UnitOfMeasureRepositoryPort {

    private final JpaUnitOfMeasureRepository unitRepository;
    private final JpaProductUnitRepository productUnitRepository;

    /**
     * Constructor con inyección de dependencias.
     * @param unitRepository Repositorio JPA maestro de unidades.
     * @param productUnitRepository Repositorio JPA para las presentaciones de productos.
     */
    public UnitOfMeasurePersistenceAdapter(
            JpaUnitOfMeasureRepository unitRepository,
            JpaProductUnitRepository productUnitRepository) {
        this.unitRepository = unitRepository;
        this.productUnitRepository = productUnitRepository;
    }

    /** {@inheritDoc} */
    @Override
    public List<UnitOfMeasure> findAll() {
        return unitRepository.findAll().stream()
                .map(UnitOfMeasureEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<UnitOfMeasure> findById(Long id) {
        return unitRepository.findById(id).map(UnitOfMeasureEntity::toDomain);
    }

    /** {@inheritDoc} */
    @Override
    public UnitOfMeasure save(UnitOfMeasure unit) {
        return unitRepository.save(UnitOfMeasureEntity.fromDomain(unit)).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    public void deleteById(Long id) {
        unitRepository.deleteById(id);
    }

    /** {@inheritDoc} */
    @Override
    public List<ProductUnit> findProductUnitsByProductId(Long productId) {
        return productUnitRepository.findByProductId(productId).stream()
                .map(ProductUnitEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    public ProductUnit saveProductUnit(ProductUnit productUnit) {
        return productUnitRepository.save(ProductUnitEntity.fromDomain(productUnit)).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    @Transactional
    public void deleteProductUnit(Long productId, Long unitId) {
        productUnitRepository.deleteByProductIdAndUnitId(productId, unitId);
    }
}

