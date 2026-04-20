package co.com.zenvory.inventario.catalog.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.application.port.out.ProductRepositoryPort;
import co.com.zenvory.inventario.catalog.domain.exception.DuplicateSkuException;
import co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import org.springframework.stereotype.Service;

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

    private final ProductRepositoryPort productRepositoryPort;

    /**
     * Constructor con inyección de dependencias.
     * @param productRepositoryPort Puerto de salida para persistencia de productos.
     */
    public ProductService(ProductRepositoryPort productRepositoryPort) {
        this.productRepositoryPort = productRepositoryPort;
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
        if (productRepositoryPort.existsBySku(product.getSku())) {
            throw new DuplicateSkuException(product.getSku());
        }
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
    public Product updateProduct(Long id, Product product) {
        Product existing = productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));

        // Solo validar unicidad de SKU si realmente cambió para evitar falsos positivos con el mismo registro
        if (!existing.getSku().equals(product.getSku()) &&
                productRepositoryPort.existsBySku(product.getSku())) {
            throw new DuplicateSkuException(product.getSku());
        }

        existing.setSku(product.getSku());
        existing.setName(product.getName());
        existing.setAverageCost(product.getAverageCost());
        existing.setSalePrice(product.getSalePrice());
        existing.setUnitId(product.getUnitId());
        existing.setSuppliersDetails(product.getSuppliersDetails());
        
        if (product.getActive() != null) {
            existing.setActive(product.getActive());
        }

        return productRepositoryPort.save(existing);
    }

    /** 
     * {@inheritDoc}
     * <p>Implementa un borrado lógico (soft-delete) marcando el producto como inactivo. 
     * Esto previene inconsistencias en registros históricos de inventario y ventas.</p>
     */
    @Override
    public void deleteProduct(Long id) {
        Product existing = productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
        
        existing.setActive(false);
        productRepositoryPort.save(existing);
    }
}

