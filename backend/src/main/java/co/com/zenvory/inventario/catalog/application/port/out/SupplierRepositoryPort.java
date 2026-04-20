package co.com.zenvory.inventario.catalog.application.port.out;

import co.com.zenvory.inventario.catalog.domain.model.Supplier;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) que define el contrato de persistencia para proveedores.
 * 
 * <p>Abstrae las operaciones de acceso a datos para la entidad de proveedores 
 * y sus asociaciones complejas con los productos del catálogo.</p>
 */
public interface SupplierRepositoryPort {

    /**
     * Recupera todos los proveedores del almacenamiento.
     * 
     * @return Lista de proveedores.
     */
    List<Supplier> findAll();

    /**
     * Busca un proveedor por su identificador primario.
     * 
     * @param id ID del proveedor.
     * @return {@link Optional} con el proveedor si existe.
     */
    Optional<Supplier> findById(Long id);

    /**
     * Persiste o actualiza un proveedor.
     * 
     * @param supplier Modelo de dominio a guardar.
     * @return El proveedor persistido.
     */
    Supplier save(Supplier supplier);

    /**
     * Elimina físicamente el registro de un proveedor.
     * 
     * @param id Identificador a eliminar.
     */
    void deleteById(Long id);

    /**
     * Verifica la existencia de un proveedor.
     * 
     * @param id Identificador a comprobar.
     * @return true si existe el registro.
     */
    boolean existsById(Long id);

    /**
     * Recupera todos los proveedores que suministran un producto específico.
     * 
     * @param productId ID del producto.
     * @return Lista de proveedores asociados.
     */
    List<Supplier> findAllByProductId(Long productId);

    /** 
     * Encuentra todos los productos suministrados por un proveedor específico. 
     * 
     * @param supplierId ID del proveedor.
     * @return Lista de productos vinculados comercialmente.
     */
    List<co.com.zenvory.inventario.catalog.domain.model.Product> findAllProductsBySupplierId(Long supplierId);
}

