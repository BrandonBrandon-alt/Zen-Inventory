package co.com.zenvory.inventario.alert.application.port.in;

import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import java.util.List;

/**
 * Puerto de entrada (Input Port) para la gestión de alertas de inventario.
 * 
 * <p>Define las operaciones permitidas para el escaneo, visualización y resolución
 * de alertas de bajo stock, quiebres de inventario o excedentes.</p>
 * 
 * <p>Esta interfaz es implementada por el servicio de aplicación y consumida por
 * los adaptadores de entrada (Controladores REST, Listeners de eventos).</p>
 */
public interface AlertUseCase {
    
    /**
     * Escanea todo el inventario global en busca de condiciones que ameriten alertas.
     * Es una operación masiva que usualmente se dispara por procesos programados.
     */
    void scanForAlerts();
    
    /**
     * Obtiene las alertas activas (no resueltas) para una sucursal específica.
     * 
     * @param branchId Identificador único de la sucursal.
     * @return Lista de alertas activas encontradas.
     */
    List<StockAlert> getActiveAlerts(Long branchId);
    
    /**
     * Obtiene todas las alertas activas en todas las sucursales del sistema.
     * 
     * @return Lista consolidada de alertas globales activas.
     */
    List<StockAlert> getGlobalActiveAlerts();
    
    /**
     * Marca una alerta como resuelta de forma genérica.
     * 
     * @param alertId Identificador de la alerta a resolver.
     */
    void resolveAlert(Long alertId);
    
    /**
     * Resuelve una alerta mediante una solicitud de traslado desde otra sucursal.
     * 
     * @param alertId Identificador de la alerta.
     * @param originBranchId Sucursal desde donde se enviará el stock.
     * @param quantity Cantidad solicitada para el traslado.
     * @param userId Usuario que autoriza la resolución.
     * @param priority Prioridad asignada al traslado (ALTA, MEDIA, BAJA).
     */
    void resolveViaTransfer(Long alertId, Long originBranchId, Integer quantity, Long userId, String priority);
    
    /**
     * Resuelve una alerta mediante la creación de una orden de compra a proveedor.
     * 
     * @param alertId Identificador de la alerta.
     * @param leadTimeDays Días estimados de entrega informados por el sistema.
     * @param quantity Cantidad a comprar.
     * @param userId Usuario que genera la orden.
     * @param isManager Indica si quien resuelve tiene rol de gerente (para validaciones de montos).
     * @param supplierId Proveedor seleccionado para la compra.
     */
    void resolveViaPurchaseOrder(Long alertId, Integer leadTimeDays, java.math.BigDecimal quantity, Long userId, boolean isManager, Long supplierId);
    
    /**
     * Descarta una alerta sin realizar ninguna acción correctiva de stock.
     * 
     * @param alertId Identificador de la alerta.
     * @param reason Motivo por el cual se descarta la alerta (ej: "Error de conteo", "Cierre de sucursal").
     */
    void dismissAlert(Long alertId, String reason);
    
    /**
     * Crea manualmente una nueva alerta en el sistema.
     * 
     * @param branchId Sucursal afectada.
     * @param productId Producto que genera la alerta.
     * @param message Descripción detallada del problema o evento.
     */
    void createAlert(Long branchId, Long productId, String message);
    
    /**
     * Crea una alerta parametrizada con tipo y referencia específica.
     * 
     * @param branchId Sucursal afectada.
     * @param productId Producto relacionado.
     * @param message Mensaje descriptivo.
     * @param type Tipo de alerta (BAJO_STOCK, QUIEBRE, etc.).
     * @param referenceId ID de un documento relacionado (ej: ID de traslado).
     */
    void createAlert(Long branchId, Long productId, String message, StockAlert.AlertType type, Long referenceId);
    
    /**
     * Verifica proactivamente si un movimiento de inventario debe generar una alerta.
     * 
     * @param inv Estado actual del inventario local disparador de la revisión.
     */
    void handleLowStockCheck(LocalInventory inv);
    
    /**
     * Verifica si una alerta previa de stock bajo debe ser resuelta automáticamente 
     * porque el stock ha sido restaurado por encima del mínimo.
     * 
     * @param branchId Sucursal a verificar.
     * @param productId Producto a verificar.
     */
    void handleRestoredStockCheck(Long branchId, Long productId);
}
