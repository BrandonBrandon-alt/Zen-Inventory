package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (Output Adapter) que implementa {@link ProductRepositoryPort}
 * usando Spring Data JPA.
 *
 * <p>Su única responsabilidad es traducir entre el modelo de dominio ({@link Product})
 * y la entidad de persistencia ({@link ProductEntity}), delegando las operaciones
 * CRUD al repositorio JPA.</p>
 *
 * <p>Si en el futuro se necesita cambiar la tecnología de persistencia (ej: MongoDB),
 * solo se reemplaza esta clase, sin tocar el dominio ni la aplicación.</p>
 */
@Component
public class ProductPersistenceAdapter implements ProductRepositoryPort {

    private final JpaProductRepository jpaRepository;

    public ProductPersistenceAdapter(JpaProductRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    /** {@inheritDoc} */
    @Override
    public List<Product> findAll() {
        return jpaRepository.findAll().stream()
                .map(ProductEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<Product> findById(Long id) {
        return jpaRepository.findById(id)
                .map(ProductEntity::toDomain);
    }

    /** {@inheritDoc} */
    @Override
    public boolean existsBySku(String sku) {
        return jpaRepository.existsBySku(sku);
    }

    /** {@inheritDoc} */
    @Override
    public Product save(Product product) {
        ProductEntity entity = ProductEntity.fromDomain(product);
        return jpaRepository.save(entity).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }
}
