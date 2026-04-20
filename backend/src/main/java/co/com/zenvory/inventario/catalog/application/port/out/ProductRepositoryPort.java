package co.com.zenvory.inventario.catalog.application.port.out;

import co.com.zenvory.inventario.catalog.domain.model.Product;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) que define el contrato de persistencia para productos.
 * 
 * <p>Permite al dominio abstraerse de la tecnología de almacenamiento, definiendo 
 * las operaciones necesarias para la lectura y escritura del catálogo maestro.</p>
 */
public interface ProductRepositoryPort {

    /**
     * Obtiene el listado completo de productos desde el almacenamiento.
     * 
     * @return Lista de modelos de dominio {@link Product}.
     */
    List<Product> findAll();

    /**
     * Busca un producto por su clave primaria.
     * 
     * @param id Identificador único.
     * @return {@link Optional} con el producto si fue localizado.
     */
    Optional<Product> findById(Long id);

    /**
     * Comprueba si un código SKU ya está en uso por otro producto.
     * 
     * @param sku Código SKU a validar.
     * @return true si el SKU ya existe en la base de datos.
     */
    boolean existsBySku(String sku);

    /**
     * Persiste o actualiza un producto en el almacenamiento.
     * 
     * @param product Modelo de dominio a guardar.
     * @return El modelo persistido.
     */
    Product save(Product product);

    /**
     * Elimina físicamente el registro de un producto.
     * 
     * @param id Identificador del producto a suprimir.
     */
    void deleteById(Long id);
}

