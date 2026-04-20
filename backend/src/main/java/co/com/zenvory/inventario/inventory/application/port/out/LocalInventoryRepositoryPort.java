package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) para la persistencia del inventario local sucursalizado.
 * 
 * <p>Define el contrato para gestionar los saldos de productos por ubicación. 
 * Permite realizar búsquedas por sucursal, detectar quiebres de stock y consolidar 
 * existencias globales de un artículo.</p>
 */
public interface LocalInventoryRepositoryPort {

    /**
     * Busca el registro de inventario para un producto en una sucursal específica.
     * 
     * @param branchId Identificador de la sucursal.
     * @param productId Identificador del producto.
     * @return Optional con el inventario local si existe.
     */
    Optional<LocalInventory> findByBranchAndProduct(Long branchId, Long productId);

    /**
     * Persiste o actualiza el registro de inventario local.
     * 
     * @param localInventory Modelo de dominio a guardar.
     * @return Modelo de dominio persistido.
     */
    LocalInventory save(LocalInventory localInventory);

    /**
     * Obtiene todos los registros de existencias para una sucursal determinada.
     * 
     * @param branchId Identificador de la sucursal.
     * @return Lista de inventarios locales.
     */
    List<LocalInventory> findByBranchId(Long branchId);

    /**
     * Identifica los registros de inventario cuya cantidad actual es inferior al stock mínimo.
     * 
     * @return Lista de inventarios con stock bajo.
     */
    List<LocalInventory> findLowStock();

    /**
     * Calcula la suma total de existencias de un producto en todas las sucursales del sistema.
     * 
     * @param productId Identificador del producto.
     * @return Cantidad total consolidada.
     */
    BigDecimal sumQuantityByProductId(Long productId);
}

