package co.com.zenvory.inventario.catalog.application.port.in;

import co.com.zenvory.inventario.catalog.domain.model.Supplier;

import java.util.List;

/**
 * Puerto de entrada (Input Port) que define las operaciones de negocio para la gestión de proveedores.
 * 
 * <p>Permite administrar la base de datos de proveedores y consultar las relaciones 
 * comerciales con los productos del catálogo.</p>
 */
public interface SupplierUseCase {

    /**
     * Recupera todos los proveedores registrados en el sistema.
     * 
     * @return Lista de modelos de dominio {@link Supplier}.
     */
    List<Supplier> getAllSuppliers();

    /**
     * Busca un proveedor específico por su identificador primario.
     * 
     * @param id Identificador único.
     * @return Modelo del proveedor encontrado.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException si no existe.
     */
    Supplier getSupplierById(Long id);

    /**
     * Registra un nuevo proveedor en el sistema.
     * 
     * @param supplier Datos iniciales del proveedor.
     * @return El proveedor guardado con ID asignado.
     */
    Supplier createSupplier(Supplier supplier);

    /**
     * Actualiza la información de un proveedor existente.
     * 
     * @param id Identificador del proveedor a modificar.
     * @param supplier Nuevos datos.
     * @return El proveedor actualizado.
     */
    Supplier updateSupplier(Long id, Supplier supplier);

    /**
     * Elimina un proveedor del sistema.
     * 
     * @param id Identificador del proveedor a retirar.
     */
    void deleteSupplier(Long id);

    /**
     * Obtiene la lista de proveedores que suministran un producto específico.
     * 
     * @param productId ID del producto.
     * @return Lista de proveedores vinculados.
     */
    List<Supplier> getSuppliersByProductId(Long productId);

    /**
     * Obtiene todos los productos que son suministrados por un proveedor determinado.
     * 
     * @param supplierId ID del proveedor.
     * @return Lista de productos del catálogo asociados al proveedor.
     */
    List<co.com.zenvory.inventario.catalog.domain.model.Product> getProductsBySupplierId(Long supplierId);
}

