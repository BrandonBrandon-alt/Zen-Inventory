package co.com.zenvory.inventario.inventory.application.port.in;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;

import java.math.BigDecimal;
import java.util.List;

/**
 * Puerto de entrada (Input Port) que define los casos de uso para la gestión de inventarios.
 * 
 * <p>Centraliza las operaciones de control de existencias, incluyendo saldos locales, 
 * movimientos de Kardex (ingresos/egresos), reservas de stock y alertas de niveles mínimos. 
 * Es la interfaz primaria para los servicios de ventas, compras y logística de sucursales.</p>
 */
public interface InventoryUseCase {
    
    /**
     * Consulta el estado de inventario para un producto particular en una sucursal.
     * 
     * @param branchId Identificador de la sucursal.
     * @param productId Identificador del producto.
     * @return Modelo de inventario local o nulo si no existe registro previo.
     */
    LocalInventory getInventory(Long branchId, Long productId);
    
    /**
     * Ejecuta una salida de mercancía de la bodega local.
     * 
     * @param branchId ID de la sucursal origen.
     * @param productId ID del producto a retirar.
     * @param productName Nombre del producto para fines de trazabilidad.
     * @param quantity Cantidad física a egresar.
     * @param unitId ID de la unidad de medida usada en la transacción.
     * @param reason Justificación operativa (e.g., VENTA, TRASLADO).
     * @param userId Usuario responsable de la acción.
     * @param referenceId ID del documento de soporte (e.g., ID de Venta).
     * @param referenceType Tipo de documento de soporte.
     * @param observations Notas adicionales.
     * @param subReason Detalle específico de la justificación.
     */
    void withdrawStock(
            Long branchId, 
            Long productId, 
            String productName,
            BigDecimal quantity, 
            Long unitId,
            MovementReason reason, 
            Long userId, 
            Long referenceId, 
            String referenceType,
            String observations,
            String subReason
    );
    
    /**
     * Ejecuta un ingreso de mercancía a la bodega local.
     * 
     * @param branchId ID de la sucursal destino.
     * @param productId ID del producto a ingresar.
     * @param quantity Cantidad física a sumar al stock.
     * @param unitId ID de la unidad de medida usada.
     * @param reason Justificación operativa (e.g., COMPRA, TRASLADO).
     * @param userId Usuario responsable.
     * @param referenceId ID del documento de soporte (e.g., ID de Compra).
     * @param referenceType Tipo de documento de soporte.
     * @param unitCost Costo unitario de la mercancía ingresada.
     * @param observations Notas adicionales.
     * @param subReason Detalle específico.
     */
    void addStock(
            Long branchId, 
            Long productId, 
            BigDecimal quantity, 
            Long unitId,
            MovementReason reason, 
            Long userId, 
            Long referenceId, 
            String referenceType,
            BigDecimal unitCost,
            String observations,
            String subReason
    );

    /**
     * Incrementa la cantidad comprometida de un producto sin afectar el stock físico.
     * Útil para apartar mercancía durante el proceso de facturación.
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @param quantity Cantidad a reservar.
     */
    void reserveStock(Long branchId, Long productId, BigDecimal quantity);
    
    /**
     * Libera una reserva previa de stock sin afectar las existencias físicas.
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @param quantity Cantidad a liberar.
     */
    void releaseStock(Long branchId, Long productId, BigDecimal quantity);

    /**
     * Recupera el estado de todos los productos en una sucursal determinada.
     * 
     * @param branchId ID de la sucursal.
     * @return Lista de inventarios locales.
     */
    List<LocalInventory> getInventoryByBranch(Long branchId);

    /**
     * Obtiene el inventario de una sucursal con metadatos descriptivos de los productos.
     * 
     * @param branchId ID de la sucursal.
     * @return Lista de inventarios enriquecidos.
     */
    List<co.com.zenvory.inventario.inventory.domain.model.LocalInventoryEnriched> getEnrichedInventoryByBranch(Long branchId);

    /**
     * Configura o actualiza el stock mínimo de seguridad para un producto en una sucursal.
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @param minimumStock Nuevo umbral de stock mínimo.
     * @return Registro de inventario actualizado.
     */
    LocalInventory updateMinimumStock(Long branchId, Long productId, BigDecimal minimumStock);

    /**
     * Consulta el historial de movimientos (Kardex) de un producto en una sucursal.
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @return Lista cronológica de movimientos.
     */
    List<InventoryMovement> getKardex(Long branchId, Long productId);

    /**
     * Identifica todos los registros de inventario que se encuentran por debajo del mínimo.
     * 
     * @return Lista de inventarios en estado crítico.
     */
    List<LocalInventory> getLowStockInventories();

    /**
     * Recupera el historial global de movimientos de todo el sistema.
     * 
     * @return Lista completa de movimientos.
     */
    List<InventoryMovement> getAllMovements();

    /**
     * Recupera los movimientos registrados en una sucursal específica.
     * 
     * @param branchId ID de la sucursal.
     * @return Lista de movimientos filtrada por sucursal.
     */
    List<InventoryMovement> getMovementsByBranch(Long branchId);
}

