package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.SupplierRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (Secondary Adapter) para la persistencia de proveedores.
 * 
 * <p>Implementa {@link SupplierRepositoryPort} utilizando repositorios JPA.
 * Facilita la traducción entre el modelo de dominio {@link Supplier} y su persistencia física,
 * incluyendo consultas transversales sobre las relaciones con productos.</p>
 */
@Component
public class SupplierPersistenceAdapter implements SupplierRepositoryPort {

    private final JpaSupplierRepository jpaRepository;
    private final JpaProductSupplierRepository productSupplierRepository;

    /**
     * Constructor con inyección de dependencias.
     * @param jpaRepository Repositorio JPA maestro de proveedores.
     * @param productSupplierRepository Repositorio JPA para la tabla asociativa con productos.
     */
    public SupplierPersistenceAdapter(JpaSupplierRepository jpaRepository, JpaProductSupplierRepository productSupplierRepository) {
        this.jpaRepository = jpaRepository;
        this.productSupplierRepository = productSupplierRepository;
    }

    /** {@inheritDoc} */
    @Override
    public List<Supplier> findAll() {
        return jpaRepository.findAll().stream()
                .map(SupplierEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<Supplier> findById(Long id) {
        return jpaRepository.findById(id).map(SupplierEntity::toDomain);
    }

    /** {@inheritDoc} */
    @Override
    public Supplier save(Supplier supplier) {
        return jpaRepository.save(SupplierEntity.fromDomain(supplier)).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }

    /** {@inheritDoc} */
    @Override
    public boolean existsById(Long id) {
        return jpaRepository.existsById(id);
    }

    /** {@inheritDoc} */
    @Override
    public List<Supplier> findAllByProductId(Long productId) {
        return productSupplierRepository.findSuppliersByProductId(productId).stream()
                .map(SupplierEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    public List<co.com.zenvory.inventario.catalog.domain.model.Product> findAllProductsBySupplierId(Long supplierId) {
        return productSupplierRepository.findProductsBySupplierId(supplierId).stream()
                .map(ProductEntity::toDomain)
                .collect(Collectors.toList());
    }
}

