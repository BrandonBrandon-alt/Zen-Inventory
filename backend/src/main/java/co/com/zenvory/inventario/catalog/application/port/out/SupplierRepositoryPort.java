package co.com.zenvory.inventario.catalog.application.port.out;

import co.com.zenvory.inventario.catalog.domain.model.Supplier;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida para la persistencia de Proveedores.
 * El dominio depende de esta interfaz; la implementación concreta
 * con JPA es {@code SupplierPersistenceAdapter}.
 */
public interface SupplierRepositoryPort {

    List<Supplier> findAll();

    Optional<Supplier> findById(Long id);

    Supplier save(Supplier supplier);

    void deleteById(Long id);

    boolean existsById(Long id);

    List<Supplier> findAllByProductId(Long productId);

    /** Encuentra todos los productos suministrados por un proveedor específico. */
    List<co.com.zenvory.inventario.catalog.domain.model.Product> findAllProductsBySupplierId(Long supplierId);
}
