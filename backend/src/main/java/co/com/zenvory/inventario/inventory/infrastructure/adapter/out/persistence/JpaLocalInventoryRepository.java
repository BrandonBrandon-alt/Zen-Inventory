package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repositorio Spring Data JPA para la entidad {@link LocalInventoryEntity}.
 * 
 * <p>Gestiona el acceso a datos para los saldos de inventario por sucursal. 
 * Incluye consultas personalizadas para la detección de stock crítico y la 
 * consolidación de existencias globales de un producto.</p>
 */
@Repository
public interface JpaLocalInventoryRepository extends JpaRepository<LocalInventoryEntity, Long> {

    /**
     * Localiza el registro de inventario para un producto y sucursal específicos.
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @return Optional con la entidad si existe.
     */
    Optional<LocalInventoryEntity> findByBranchIdAndProductId(Long branchId, Long productId);

    /**
     * Busca registros donde la existencia actual es inferior o igual al stock mínimo de seguridad.
     * Solo considera productos que tengan configurado un stock mínimo mayor a cero.
     * 
     * @return Lista de inventarios en estado de alerta.
     */
    @Query("SELECT i FROM LocalInventoryEntity i WHERE i.currentQuantity <= i.minimumStock AND i.minimumStock > 0")
    List<LocalInventoryEntity> findLowStock();

    /**
     * Recupera todos los registros de inventario de una sucursal.
     * 
     * @param branchId ID de la sucursal.
     * @return Lista de existencias locales.
     */
    List<LocalInventoryEntity> findByBranchId(Long branchId);

    /**
     * Calcula el stock total consolidado de un producto sumando las existencias de todas las sucursales.
     * 
     * @param productId ID del producto a consolidar.
     * @return Sumatoria total de cantidades (0 si no hay registros).
     */
    @Query("SELECT COALESCE(SUM(i.currentQuantity), 0) FROM LocalInventoryEntity i WHERE i.productId = :productId")
    java.math.BigDecimal sumQuantityByProductId(Long productId);
}

