package co.com.zenvory.inventario.catalog.application.port.in;

import co.com.zenvory.inventario.catalog.domain.model.Supplier;

import java.util.List;

/**
 * Puerto de entrada para los casos de uso de Proveedores.
 * Define el contrato CRUD que el exterior puede invocar.
 */
public interface SupplierUseCase {

    /** Retorna todos los proveedores registrados. */
    List<Supplier> getAllSuppliers();

    /**
     * Busca un proveedor por ID.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException si no existe.
     */
    Supplier getSupplierById(Long id);

    /** Crea un nuevo proveedor. */
    Supplier createSupplier(Supplier supplier);

    /**
     * Actualiza los datos de un proveedor existente.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException si no existe.
     */
    Supplier updateSupplier(Long id, Supplier supplier);

    /**
     * Elimina un proveedor por ID.
     * @throws co.com.zenvory.inventario.catalog.domain.exception.SupplierNotFoundException si no existe.
     */
    void deleteSupplier(Long id);

    /** Retorna los proveedores asociados a un producto específico por su ID. */
    List<Supplier> getSuppliersByProductId(Long productId);

    /** Retorna los productos suministrados por un proveedor específico. */
    List<co.com.zenvory.inventario.catalog.domain.model.Product> getProductsBySupplierId(Long supplierId);
}
