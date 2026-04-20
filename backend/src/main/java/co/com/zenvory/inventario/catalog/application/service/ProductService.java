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
 * Servicio de aplicación que implementa los casos de uso del catálogo.
 */
@Service
public class ProductService implements ProductUseCase {

    private final ProductRepositoryPort productRepositoryPort;

    public ProductService(ProductRepositoryPort productRepositoryPort) {
        this.productRepositoryPort = productRepositoryPort;
    }

    @Override
    public List<Product> getAllProducts() {
        return productRepositoryPort.findAll();
    }

    @Override
    public Product getProductById(Long id) {
        return productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
    }

    /**
     * Crea un nuevo producto validando que el SKU no exista previamente.
     * @throws DuplicateSkuException si el SKU ya está registrado (HTTP 409).
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
     * Actualiza un producto existente. Si el SKU cambia, verifica que el nuevo no esté en uso.
     * @throws ProductNotFoundException si el producto no existe.
     * @throws DuplicateSkuException si el nuevo SKU ya pertenece a otro producto.
     */
    @Override
    public Product updateProduct(Long id, Product product) {
        Product existing = productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));

        // Solo validar unicidad de SKU si realmente cambió
        if (!existing.getSku().equals(product.getSku()) &&
                productRepositoryPort.existsBySku(product.getSku())) {
            throw new DuplicateSkuException(product.getSku());
        }

        existing.setSku(product.getSku());
        existing.setName(product.getName());
        existing.setAverageCost(product.getAverageCost());
        existing.setSalePrice(product.getSalePrice());
        existing.setUnitId(product.getUnitId());
        
        if (product.getActive() != null) {
            existing.setActive(product.getActive());
        }

        return productRepositoryPort.save(existing);
    }

    @Override
    public void deleteProduct(Long id) {
        Product existing = productRepositoryPort.findById(id)
                .orElseThrow(() -> new ProductNotFoundException(id));
        
        // Soft-delete: desactivar en lugar de borrar físicamente
        existing.setActive(false);
        productRepositoryPort.save(existing);
    }
}
