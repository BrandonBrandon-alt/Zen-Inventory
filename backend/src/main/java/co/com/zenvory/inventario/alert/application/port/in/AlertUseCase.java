package co.com.zenvory.inventario.alert.application.port.in;

import co.com.zenvory.inventario.alert.domain.model.StockAlert;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import java.util.List;

public interface AlertUseCase {
    void scanForAlerts();
    List<StockAlert> getActiveAlerts(Long branchId);
    List<StockAlert> getGlobalActiveAlerts();
    void resolveAlert(Long alertId);
    
    // Decision Gateway Methods
    void resolveViaTransfer(Long alertId, Long originBranchId, Integer quantity, Long userId);
    void resolveViaPurchaseOrder(Long alertId, java.time.LocalDateTime estimatedArrival, java.math.BigDecimal quantity);
    void dismissAlert(Long alertId, String reason);
    
    void createAlert(Long branchId, Long productId, String message);
    void createAlert(Long branchId, Long productId, String message, StockAlert.AlertType type, Long referenceId);
    void handleLowStockCheck(LocalInventory inv);
    void handleRestoredStockCheck(Long branchId, Long productId);
}
