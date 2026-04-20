package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Repositorio Spring Data JPA para la entidad {@link InventoryMovementEntity}.
 * 
 * <p>Proporciona las capacidades de acceso a datos para el historial de movimientos, 
 * incluyendo consultas filtradas por sucursal y producto, siempre priorizando 
 * el orden cronológico descendente para facilitar la lectura del Kardex.</p>
 */
public interface JpaInventoryMovementRepository extends JpaRepository<InventoryMovementEntity, Long> {

    /**
     * Recupera los movimientos de un producto en una sucursal, ordenados por fecha (más reciente primero).
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @return Lista de entidades de movimiento.
     */
    List<InventoryMovementEntity> findByBranchIdAndProductIdOrderByDateDesc(Long branchId, Long productId);

    /**
     * Recupera todos los movimientos de una sucursal, ordenados por fecha.
     * 
     * @param branchId ID de la sucursal.
     * @return Lista de entidades de movimiento.
     */
    List<InventoryMovementEntity> findByBranchIdOrderByDateDesc(Long branchId);

    /**
     * Recupera el historial global de movimientos ordenado cronológicamente.
     * 
     * @return Lista de todos los movimientos del sistema.
     */
    List<InventoryMovementEntity> findAllByOrderByDateDesc();
}

