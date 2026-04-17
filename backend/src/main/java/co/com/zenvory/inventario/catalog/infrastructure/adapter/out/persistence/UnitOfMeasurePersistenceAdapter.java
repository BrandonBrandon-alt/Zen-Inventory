package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.UnitOfMeasureRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida que implementa {@link UnitOfMeasureRepositoryPort} con Spring Data JPA.
 * Gestiona tanto las unidades de medida como sus relaciones con los productos.
 */
@Component
public class UnitOfMeasurePersistenceAdapter implements UnitOfMeasureRepositoryPort {

    private final JpaUnitOfMeasureRepository unitRepository;
    private final JpaProductUnitRepository productUnitRepository;

    public UnitOfMeasurePersistenceAdapter(
            JpaUnitOfMeasureRepository unitRepository,
            JpaProductUnitRepository productUnitRepository) {
        this.unitRepository = unitRepository;
        this.productUnitRepository = productUnitRepository;
    }

    @Override
    public List<UnitOfMeasure> findAll() {
        return unitRepository.findAll().stream()
                .map(UnitOfMeasureEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<UnitOfMeasure> findById(Long id) {
        return unitRepository.findById(id).map(UnitOfMeasureEntity::toDomain);
    }

    @Override
    public UnitOfMeasure save(UnitOfMeasure unit) {
        return unitRepository.save(UnitOfMeasureEntity.fromDomain(unit)).toDomain();
    }

    @Override
    public void deleteById(Long id) {
        unitRepository.deleteById(id);
    }

    @Override
    public List<ProductUnit> findProductUnitsByProductId(Long productId) {
        return productUnitRepository.findByProductId(productId).stream()
                .map(ProductUnitEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public ProductUnit saveProductUnit(ProductUnit productUnit) {
        return productUnitRepository.save(ProductUnitEntity.fromDomain(productUnit)).toDomain();
    }
}
