package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.SupplierRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida que implementa {@link SupplierRepositoryPort} con Spring Data JPA.
 * Traduce entre el modelo de dominio {@link Supplier} y la entidad {@link SupplierEntity}.
 */
@Component
public class SupplierPersistenceAdapter implements SupplierRepositoryPort {

    private final JpaSupplierRepository jpaRepository;
    private final JpaProductSupplierRepository productSupplierRepository;

    public SupplierPersistenceAdapter(JpaSupplierRepository jpaRepository, JpaProductSupplierRepository productSupplierRepository) {
        this.jpaRepository = jpaRepository;
        this.productSupplierRepository = productSupplierRepository;
    }

    @Override
    public List<Supplier> findAll() {
        return jpaRepository.findAll().stream()
                .map(SupplierEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Supplier> findById(Long id) {
        return jpaRepository.findById(id).map(SupplierEntity::toDomain);
    }

    @Override
    public Supplier save(Supplier supplier) {
        return jpaRepository.save(SupplierEntity.fromDomain(supplier)).toDomain();
    }

    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    @Override
    public boolean existsById(Long id) {
        return jpaRepository.existsById(id);
    }

    @Override
    public List<Supplier> findAllByProductId(Long productId) {
        return productSupplierRepository.findSuppliersByProductId(productId).stream()
                .map(SupplierEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<co.com.zenvory.inventario.catalog.domain.model.Product> findAllProductsBySupplierId(Long supplierId) {
        return productSupplierRepository.findProductsBySupplierId(supplierId).stream()
                .map(ProductEntity::toDomain)
                .collect(Collectors.toList());
    }
}
