package co.com.zenvory.inventario.alert.infrastructure.adapter.in.event;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Component;

/**
 * Adaptador de entrada (Primary Adapter) basado en eventos.
 * 
 * <p>Esta clase se encarga de reaccionar a los eventos disparados por el dominio 
 * de inventario para generar o resolver alertas de forma reactiva y asíncrona.</p>
 * 
 * <p>Contexto: Permite desacoplar el módulo de Inventario del de Alertas, 
 * utilizando el bus de eventos de Spring como canal de comunicación.</p>
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StockAlertListener {

    private final AlertUseCase alertUseCase;
    private final InventoryUseCase inventoryUseCase;

    /**
     * Escucha eventos de caída de stock (StockLevelDroppedEvent).
     * Dispara una verificación proactiva para determinar si se requiere una alerta formal.
     * 
     * @param event Datos del producto y sucursal donde ocurrió la baja de stock.
     */
    @EventListener
    public void onStockLevelDropped(StockLevelDroppedEvent event) {
        log.info("Recibido evento StockLevelDropped para producto {} en sucursal {}", 
                event.getProductId(), event.getBranchId());
        
        try {
            // Obtenemos el estado actual del inventario para pasar el contexto completo al caso de uso.
            LocalInventory inventory = inventoryUseCase.getInventory(event.getBranchId(), event.getProductId());
            alertUseCase.handleLowStockCheck(inventory);
        } catch (Exception e) {
            log.error("Error al procesar alerta inmediata por baja de stock: {}", e.getMessage());
        }
    }

    /**
     * Escucha eventos de restauración de stock (StockLevelRestoredEvent).
     * Dispara el proceso de auto-resolución de alertas relacionadas.
     * 
     * @param event Datos del producto y sucursal donde se normalizó el stock.
     */
    @EventListener
    public void onStockLevelRestored(co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent event) {
        log.info("Recibido evento StockLevelRestored para producto {} en sucursal {}", 
                event.getProductId(), event.getBranchId());
        
        try {
            // Delegamos la validación de alertas existentes que puedan marcarse como resueltas.
            alertUseCase.handleRestoredStockCheck(event.getBranchId(), event.getProductId());
        } catch (Exception e) {
            log.error("Error al procesar auto-resolución de alerta por restauración: {}", e.getMessage());
        }
    }
}
