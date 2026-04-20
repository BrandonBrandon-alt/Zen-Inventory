package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

/** Repositorio Spring Data JPA para la relación Producto-Proveedor. */
public interface JpaProductSupplierRepository extends JpaRepository<ProductSupplierEntity, Long> {

    /** Encuentra todos los proveedores asociados a un producto específico. */
    @Query("SELECT ps.supplier FROM ProductSupplierEntity ps WHERE ps.productId = :productId")
    List<SupplierEntity> findSuppliersByProductId(Long productId);

    /** Encuentra la relación específica entre un producto y un proveedor. */
    java.util.Optional<ProductSupplierEntity> findByProductIdAndSupplierId(Long productId, Long supplierId);

    /** Encuentra todos los productos suministrados por un proveedor específico. */
    @Query("SELECT ps.product FROM ProductSupplierEntity ps WHERE ps.supplierId = :supplierId")
    List<ProductEntity> findProductsBySupplierId(Long supplierId);
}
