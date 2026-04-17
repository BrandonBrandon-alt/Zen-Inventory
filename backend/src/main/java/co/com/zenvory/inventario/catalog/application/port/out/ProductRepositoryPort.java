package co.com.zenvory.inventario.catalog.application.port.out;

import co.com.zenvory.inventario.catalog.domain.model.Product;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) para la persistencia del catálogo de productos.
 *
 * <p>Esta interfaz es requerida por el dominio para interactuar con el almacenamiento,
 * sin saber si detrás hay PostgreSQL, MongoDB o un repositorio en memoria.
 * El adaptador {@code ProductPersistenceAdapter} la implementa con JPA.</p>
 */
public interface ProductRepositoryPort {

    /**
     * Recupera todos los productos del almacenamiento.
     * @return Lista de modelos de dominio.
     */
    List<Product> findAll();

    /**
     * Busca un producto por su ID en el almacenamiento.
     * @param id Identificador único.
     * @return Optional con el modelo de dominio si existe.
     */
    Optional<Product> findById(Long id);

    /**
     * Verifica si ya existe un producto con el SKU dado.
     * Útil para validar unicidad antes de crear.
     * @param sku Código SKU a verificar.
     * @return {@code true} si el SKU ya está registrado.
     */
    boolean existsBySku(String sku);

    /**
     * Persiste un producto (crea o actualiza).
     * @param product Modelo de dominio a guardar.
     * @return El modelo de dominio persistido con ID asignado.
     */
    Product save(Product product);

    /**
     * Elimina un producto por su ID.
     * @param id Identificador del producto a eliminar.
     */
    void deleteById(Long id);
}
