package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

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
    private final JpaSupplierRepository supplierRepository;

    public ProductPersistenceAdapter(JpaProductRepository jpaRepository, JpaSupplierRepository supplierRepository) {
        this.jpaRepository = jpaRepository;
        this.supplierRepository = supplierRepository;
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
    public List<Product> findAll() {
        return jpaRepository.findAll().stream()
                .map(ProductEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    @Transactional(readOnly = true)
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
    @Transactional
    public Product save(Product product) {
        // 1. Obtener o crear la entidad base
        ProductEntity entity;
        boolean isNew = product.getId() == null;

        if (!isNew) {
            entity = jpaRepository.findById(product.getId())
                    .orElseThrow(() -> new RuntimeException("Producto no encontrado: " + product.getId()));
            
            // Actualizar campos básicos
            entity.setSku(product.getSku());
            entity.setName(product.getName());
            entity.setAverageCost(product.getAverageCost());
            entity.setSalePrice(product.getSalePrice());
            entity.setUnit(product.getUnitId() != null ? 
                UnitOfMeasureEntity.builder().id(product.getUnitId()).build() : null);
            entity.setActive(product.getActive());
            
            // Limpiar proveedores actuales para sincronizar (orphanRemoval se encarga del resto)
            entity.getSuppliers().clear();
        } else {
            entity = ProductEntity.fromDomain(product);
            entity.setCreatedAt(java.time.LocalDateTime.now());
            // Guardar para generar ID antes de asociar proveedores
            entity = jpaRepository.save(entity);
        }

        // 2. Sincronizar proveedores desde los IDs del dominio
        if (product.getSupplierIds() != null && !product.getSupplierIds().isEmpty()) {
            for (Long supplierId : product.getSupplierIds()) {
                SupplierEntity supplierRef = supplierRepository.getReferenceById(supplierId);
                
                ProductSupplierEntity relation = ProductSupplierEntity.builder()
                        .product(entity)
                        .productId(entity.getId())
                        .supplier(supplierRef)
                        .supplierId(supplierId)
                        .negotiatedPrice(java.math.BigDecimal.ZERO)
                        .deliveryDays(0)
                        .preferred(true)
                        .build();
                
                entity.getSuppliers().add(relation);
            }
        }

        // 3. Guardar cambios finales (relaciones) y retornar
        return jpaRepository.save(entity).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }
}
