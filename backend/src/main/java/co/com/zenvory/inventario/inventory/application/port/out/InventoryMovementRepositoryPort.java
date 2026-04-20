package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import java.util.List;

/**
 * Puerto de salida (Output Port) para la persistencia del historial de movimientos (Kardex).
 * 
 * <p>Define las operaciones necesarias para almacenar y recuperar el rastro de auditoría 
 * de los cambios en el inventario. Desacopla la lógica de negocio de la tecnología 
 * de persistencia específica (JPA, NoSQL, etc.).</p>
 */
public interface InventoryMovementRepositoryPort {

    /**
     * Registra un nuevo movimiento de inventario de forma permanente.
     * 
     * @param movement Datos del movimiento a persistir.
     * @return El movimiento guardado con su identificador asignado.
     */
    InventoryMovement save(InventoryMovement movement);

    /**
     * Recupera el historial cronológico de movimientos para un producto en una sucursal.
     * 
     * @param branchId Identificador de la sucursal.
     * @param productId Identificador del producto.
     * @return Lista de movimientos registrados.
     */
    List<InventoryMovement> findByBranchAndProduct(Long branchId, Long productId);

    /**
     * Obtiene el listado global de todos los movimientos registrados en el sistema.
     * 
     * @return Lista total de movimientos.
     */
    List<InventoryMovement> findAll();

    /**
     * Recupera los movimientos efectuados en una sucursal específica.
     * 
     * @param branchId Identificador de la sucursal.
     * @return Lista de movimientos filtrada por ubicación.
     */
    List<InventoryMovement> findByBranchId(Long branchId);
}

