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
 * Escucha los eventos de caída de nivel de stock para generar alertas en tiempo real.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StockAlertListener {

    private final AlertUseCase alertUseCase;
    private final InventoryUseCase inventoryUseCase;

    @EventListener
    public void onStockLevelDropped(StockLevelDroppedEvent event) {
        log.info("Recibido evento StockLevelDropped para producto {} en sucursal {}", 
                event.getProductId(), event.getBranchId());
        
        try {
            LocalInventory inventory = inventoryUseCase.getInventory(event.getBranchId(), event.getProductId());
            alertUseCase.handleLowStockCheck(inventory);
        } catch (Exception e) {
            log.error("Error al procesar alerta inmediatada: {}", e.getMessage());
        }
    }

    @EventListener
    public void onStockLevelRestored(co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent event) {
        log.info("Recibido evento StockLevelRestored para producto {} en sucursal {}", 
                event.getProductId(), event.getBranchId());
        
        try {
            alertUseCase.handleRestoredStockCheck(event.getBranchId(), event.getProductId());
        } catch (Exception e) {
            log.error("Error al auto-resolver alerta: {}", e.getMessage());
        }
    }
}
