package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.audit.application.port.in.CatalogAuditUseCase;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.audit.domain.service.ProductChanges;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.application.port.out.SupplierRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.DuplicateSkuException;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicación que implementa la orquestación de lógica para el catálogo de productos.
 * 
 * <p>Gestiona el ciclo de vida de los productos, asegurando la integridad de datos 
 * (como la unicidad del SKU) y aplicando políticas de negocio como el borrado lógico.</p>
 */
@Service
public class ProductService implements ProductUseCase {
 
    private static final Logger log = LoggerFactory.getLogger(ProductService.class);

    private final ProductRepositoryPort productRepositoryPort;
    private final SupplierRepositoryPort supplierRepositoryPort;
    private final CatalogAuditUseCase catalogAudit;

    public ProductService(ProductRepositoryPort productRepositoryPort, SupplierRepositoryPort supplierRepositoryPort,
                          CatalogAuditUseCase catalogAudit) {
        this.productRepositoryPort = productRepositoryPort;
        this.supplierRepositoryPort = supplierRepositoryPort;
        this.catalogAudit = catalogAudit;
    }

    /** {@inheritDoc} */
    @Override
    public List<Product> getAllProducts() {
        return productRepositoryPort.findAll();
    }

    /** 
     * {@inheritDoc} 
     * @throws ProductNotFoundException Si el ID solicitado no existe.
     */
    @Override
    public Product getProductForCostUpdate(Long id) {
        if (!productRepositoryPort.lockById(id)) {
            throw new ProductNotFoundException(id);
        }
        return getProductById(id);
    }

    @Override
    public void updateAverageCost(Long id, java.math.BigDecimal averageCost) {
        productRepositoryPort.updateAverageCost(id, averageCost);
    }

    @Override
    public Product getProductById(Long id) {
        return productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
    }

    /**
     * {@inheritDoc}
     * <p>Valida la unicidad del código SKU antes de la persistencia.</p>
     * @throws DuplicateSkuException Si el SKU ya está registrado por otro producto.
     */
    @Override
    public Product createProduct(Product product) {
        String sku = product.getSku() != null ? product.getSku().trim() : null;
        if (productRepositoryPort.existsBySku(sku)) {
            log.warn("Intento de creación de producto con SKU duplicado: {}", sku);
            throw new DuplicateSkuException(sku);
        }
        product.setSku(sku);
        product.setCreatedAt(LocalDateTime.now());
        product.setActive(true);
        return productRepositoryPort.save(product);
    }

    /**
     * {@inheritDoc}
     * <p>Permite la actualización parcial o total de los datos. Si el SKU es modificado,
     * se verifica nuevamente su disponibilidad.</p>
     * @throws DuplicateSkuException Si el nuevo SKU colisiona con uno existente.
     */
    @Override
    @Transactional
    public Product updateProduct(Long id, Product product) {
        Product existing = productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
        Product before = existing.toBuilder().build();

        String newSku = product.getSku() != null ? product.getSku().trim() : null;
        
        // Solo validar unicidad de SKU si realmente cambió para evitar falsos positivos con el mismo registro
        if (newSku != null && !existing.getSku().equals(newSku) &&
                productRepositoryPort.existsBySku(newSku)) {
            log.warn("Intento de actualización de producto {} a un SKU ya existente: {}", id, newSku);
            throw new DuplicateSkuException(newSku);
        }

        // Las presentaciones, el stock y los movimientos están expresados en la unidad base: cambiarla los reinterpretaría.
        if (product.getUnitId() != null && !product.getUnitId().equals(existing.getUnitId()) && productRepositoryPort.isBaseUnitInUse(id)) {
            throw new IllegalArgumentException("No se puede cambiar la unidad base: el producto ya tiene presentaciones, stock o movimientos en esa unidad.");
        }

        existing.setSku(newSku);
        existing.setName(product.getName());
        // El costo promedio lo calcula el sistema con cada compra: editar el producto sin enviarlo (o con otro
        // valor desactualizado) no debe borrarlo. Solo se cambia si la petición lo trae explícitamente.
        if (product.getAverageCost() != null) {
            existing.setAverageCost(product.getAverageCost());
        }
        existing.setSalePrice(product.getSalePrice());
        existing.setUnitId(product.getUnitId());
        existing.setSuppliersDetails(product.getSuppliersDetails());
        
        if (product.getActive() != null) {
            existing.setActive(product.getActive());
        }

        Product saved = productRepositoryPort.save(existing);
        audit(before, existing);
        return saved;
    }

    /** 
     * {@inheritDoc}
     * <p>Implementa un borrado lógico (soft-delete) marcando el producto como inactivo. 
     * Esto previene inconsistencias en registros históricos de inventario y ventas.</p>
     */
    @Override
    @Transactional
    public void deleteProduct(Long id) {
        Product existing = productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
        Product before = existing.toBuilder().build();

        existing.setActive(false);
        productRepositoryPort.save(existing);
        audit(before, existing);
    }

    /** Deja en la auditoría del catálogo lo que cambió (en la misma transacción que el cambio). */
    private void audit(Product before, Product after) {
        catalogAudit.record(ChangedEntity.PRODUCTO, before.getId(), after.getName(),
                ProductChanges.diff(before, after, this::supplierName));
    }

    private String supplierName(Long supplierId) {
        return supplierRepositoryPort.findById(supplierId).map(Supplier::getName).orElse("#" + supplierId);
    }
}
