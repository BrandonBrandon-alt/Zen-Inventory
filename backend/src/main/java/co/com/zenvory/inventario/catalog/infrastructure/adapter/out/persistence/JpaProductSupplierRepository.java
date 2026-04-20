package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import java.util.List;

/**
 * Repositorio Spring Data JPA para la entidad asociativa {@link ProductSupplierEntity}.
 * 
 * <p>Gestiona la persistencia de los vínculos entre productos y sus proveedores.
 * Facilita consultas bidireccionales para resolver qué proveedores tiene un producto 
 * y qué productos suministra un proveedor.</p>
 */
public interface JpaProductSupplierRepository extends JpaRepository<ProductSupplierEntity, Long> {

    /** 
     * Recupera la lista de proveedores (entidades puras) vinculados a un producto. 
     * 
     * @param productId Identificador del producto.
     * @return Lista de proveedores asociados.
     */
    @Query("SELECT ps.supplier FROM ProductSupplierEntity ps WHERE ps.productId = :productId")
    List<SupplierEntity> findSuppliersByProductId(Long productId);

    /** 
     * Busca el registro de condiciones comerciales para una dupla específica de producto y proveedor. 
     * 
     * @param productId Identificador del producto.
     * @param supplierId Identificador del proveedor.
     * @return Optional con la entidad de relación si existe.
     */
    java.util.Optional<ProductSupplierEntity> findByProductIdAndSupplierId(Long productId, Long supplierId);

    /** 
     * Recupera la lista de productos (entidades puras) suministrados por un proveedor. 
     * 
     * @param supplierId Identificador del proveedor.
     * @return Lista de productos asociados.
     */
    @Query("SELECT ps.product FROM ProductSupplierEntity ps WHERE ps.supplierId = :supplierId")
    List<ProductEntity> findProductsBySupplierId(Long supplierId);
}

