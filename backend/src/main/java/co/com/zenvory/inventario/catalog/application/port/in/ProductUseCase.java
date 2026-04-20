package co.com.zenvory.inventario.catalog.application.port.in;

import co.com.zenvory.inventario.catalog.domain.model.Product;

import java.util.List;

/**
 * Puerto de entrada (Input Port) que define las operaciones de negocio para la gestión de productos.
 * 
 * <p>Establece el contrato para administrar el catálogo maestro, asegurando el desacoplamiento 
 * entre los adaptadores de entrada y la lógica de dominio.</p>
 */
public interface ProductUseCase {

    /**
     * Recupera el listado completo de productos registrados en el sistema.
     * 
     * @return Lista de modelos de dominio {@link Product}.
     */
    List<Product> getAllProducts();

    /**
     * Busca un producto específico por su identificador primario.
     * 
     * @param id Identificador único del producto.
     * @return El modelo de dominio del producto encontrado.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException Si el producto no existe.
     */
    Product getProductById(Long id);

    /**
     * Registra un nuevo producto en el catálogo persistente.
     * 
     * @param product Modelo de dominio con los datos iniciales.
     * @return El producto guardado con ID y metadatos de auditoría.
     */
    Product createProduct(Product product);

    /**
     * Actualiza la información técnica o comercial de un producto existente.
     * 
     * @param id Identificador del producto a modificar.
     * @param product Datos actualizados.
     * @return El producto reflejando los cambios.
     */
    Product updateProduct(Long id, Product product);

    /**
     * Elimina lógicamente un producto del catálogo maestro.
     * 
     * @param id Identificador del producto a retirar.
     */
    void deleteProduct(Long id);
}

