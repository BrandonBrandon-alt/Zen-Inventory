package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (Secondary Adapter) para la persistencia de productos.
 * 
 * <p>Implementa {@link ProductRepositoryPort} utilizando repositorios JPA.
 * Gestiona la persistencia compleja de productos, incluyendo la sincronización 
 * de la tabla asociativa con proveedores (relación Many-to-Many enriquecida).</p>
 */
@Component
public class ProductPersistenceAdapter implements ProductRepositoryPort {

    private final JpaProductRepository jpaRepository;
    private final JpaSupplierRepository supplierRepository;

    /**
     * Constructor para inyección de dependencias.
     * @param jpaRepository Repositorio JPA de productos.
     * @param supplierRepository Repositorio JPA de proveedores (requerido para referencias).
     */
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

    /**
     * {@inheritDoc}
     * <p>Este método realiza una sincronización manual de la colección de proveedores 
     * para mantener la integridad referencial y aplicar correctamente los cambios 
     * (altas, bajas y modificaciones) en la relación Many-to-Many.</p>
     */
    @Override
    @Transactional
    public Product save(Product product) {
        ProductEntity entity;
        boolean isNew = product.getId() == null;

        // 1. Carga o inicialización de la entidad
        if (!isNew) {
            entity = jpaRepository.findById(product.getId())
                    .orElseThrow(() -> new RuntimeException("Producto no encontrado: " + product.getId()));

            // Sincronización de atributos básicos
            entity.setSku(product.getSku());
            entity.setName(product.getName());
            entity.setAverageCost(product.getAverageCost());
            entity.setSalePrice(product.getSalePrice());
            entity.setUnit(
                    product.getUnitId() != null ? UnitOfMeasureEntity.builder().id(product.getUnitId()).build() : null);
            entity.setActive(product.getActive());
        } else {
            entity = ProductEntity.fromDomain(product);
            entity.setCreatedAt(java.time.LocalDateTime.now());
            if (entity.getSuppliers() == null) {
                entity.setSuppliers(new java.util.ArrayList<>());
            }
            // Persistencia inicial para generar ID necesario en las claves foráneas de la relación
            entity = jpaRepository.save(entity);
        }

        // 2. Sincronización de la relación con Proveedores (ProductSupplierEntity)
        if (product.getSuppliersDetails() != null && !product.getSuppliersDetails().isEmpty()) {

            // Mapeo indexado de los detalles entrantes para optimizar la búsqueda
            java.util.Map<Long, co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail> incomingDetails = product
                    .getSuppliersDetails().stream()
                    .collect(java.util.stream.Collectors.toMap(
                            co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail::supplierId,
                            detail -> detail));

            // Procesamiento de registros existentes: Actualización coordinada o eliminación
            java.util.Iterator<ProductSupplierEntity> iterator = entity.getSuppliers().iterator();
            while (iterator.hasNext()) {
                ProductSupplierEntity existingRelation = iterator.next();
                Long existingSupplierId = existingRelation.getSupplierId();

                if (incomingDetails.containsKey(existingSupplierId)) {
                    // CASO: El vínculo ya existe -> Actualizamos condiciones comerciales
                    var incomingDetail = incomingDetails.get(existingSupplierId);
                    existingRelation.setNegotiatedPrice(incomingDetail.negotiatedPrice());
                    existingRelation.setDeliveryDays(incomingDetail.deliveryDays());
                    existingRelation.setPreferred(incomingDetail.preferred());

                    incomingDetails.remove(existingSupplierId); // Marcado como procesado
                } else {
                    // CASO: El vínculo ya no está en la petición -> Eliminamos relación
                    iterator.remove();
                }
            }

            // Procesamiento de registros nuevos: Inserción de nuevas duplas producto-proveedor
            for (co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail newDetail : incomingDetails
                    .values()) {
                SupplierEntity supplierRef = supplierRepository.getReferenceById(newDetail.supplierId());

                ProductSupplierEntity newRelation = ProductSupplierEntity.builder()
                        .product(entity)
                        .productId(entity.getId())
                        .supplier(supplierRef)
                        .supplierId(newDetail.supplierId())
                        .negotiatedPrice(newDetail.negotiatedPrice() != null ? newDetail.negotiatedPrice()
                                : java.math.BigDecimal.ZERO)
                        .deliveryDays(newDetail.deliveryDays() != null ? newDetail.deliveryDays() : 0)
                        .preferred(newDetail.preferred() != null ? newDetail.preferred() : false)
                        .build();

                entity.getSuppliers().add(newRelation);
            }

        } else {
            // Limpieza total si la petición no incluye proveedores
            if (entity.getSuppliers() != null) {
                entity.getSuppliers().clear();
            }
        }

        // 3. Persistencia final y reconversión a dominio
        return jpaRepository.save(entity).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    public void deleteById(Long id) {
        jpaRepository.deleteById(id);
    }
}
