package co.com.zenvory.inventario.catalog.application.port.in;

import co.com.zenvory.inventario.catalog.domain.model.Product;

import java.util.List;

/**
 * Puerto de entrada (Input Port) para los casos de uso del catálogo de productos.
 *
 * <p>Define el contrato de lo que el exterior puede pedirle a la aplicación
 * en relación al catálogo. Los adaptadores de entrada (ej: {@code ProductController})
 * dependen de esta interfaz, nunca de la implementación concreta.</p>
 */
public interface ProductUseCase {

    /**
     * Obtiene todos los productos del catálogo.
     * @return Lista completa de modelos de dominio Product.
     */
    List<Product> getAllProducts();

    /**
     * Busca un producto específico por su identificador.
     * @param id Identificador único del producto.
     * @return El modelo de dominio del producto encontrado.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException
     *         si el producto no existe.
     */
    Product getProductById(Long id);

    /**
     * Registra un nuevo producto en el catálogo.
     * @param product Modelo de dominio con los datos del producto a crear.
     * @return El producto creado con su ID y fecha de alta asignados.
     */
    Product createProduct(Product product);

    /**
     * Actualiza los datos de un producto existente.
     * @param id      Identificador del producto a actualizar.
     * @param product Modelo de dominio con los nuevos valores.
     * @return El producto actualizado.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException
     *         si el producto no existe.
     */
    Product updateProduct(Long id, Product product);

    /**
     * Elimina un producto del catálogo por su identificador.
     * @param id Identificador del producto a eliminar.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException
     *         si el producto no existe.
     */
    void deleteProduct(Long id);
}
