package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
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
     * Igual que {@link #findByBranchIdAndProductId} pero bloquea la fila hasta el fin de la transacción
     * ({@code SELECT ... FOR UPDATE}). Toda lectura-modificación-escritura del saldo debe usarla: sin el bloqueo,
     * dos operaciones simultáneas leen el mismo saldo y la segunda pisa a la primera.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("SELECT i FROM LocalInventoryEntity i WHERE i.branchId = :branchId AND i.productId = :productId")
    Optional<LocalInventoryEntity> findByBranchIdAndProductIdForUpdate(@Param("branchId") Long branchId, @Param("productId") Long productId);

    /**
     * Crea la fila (con ceros) si no existe, sin error si otra transacción la crea a la vez. Se usa antes de bloquear:
     * sin fila no hay nada que bloquear y dos primeras operaciones simultáneas intentarían insertar las dos.
     */
    @org.springframework.data.jpa.repository.Modifying
    @Query(value = "INSERT INTO inventario_local (sucursal_id, producto_id, cantidad_actual, stock_minimo, stock_comprometido, last_updated) "
            + "VALUES (:branchId, :productId, 0, 0, 0, now()) ON CONFLICT (sucursal_id, producto_id) DO NOTHING", nativeQuery = true)
    void insertIfAbsent(@Param("branchId") Long branchId, @Param("productId") Long productId);

    /**
     * Busca registros donde la existencia actual es inferior o igual al stock mínimo de seguridad.
     * Solo considera productos que tengan configurado un stock mínimo mayor a cero.
     * 
     * @return Lista de inventarios en estado de alerta.
     */
    @Query("SELECT i FROM LocalInventoryEntity i WHERE (i.currentQuantity - COALESCE(i.committedQuantity, 0)) <= i.minimumStock AND i.minimumStock > 0")
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

