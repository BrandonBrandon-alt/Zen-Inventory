package co.com.zenvory.inventario.alert.application.port.out;

import co.com.zenvory.inventario.alert.domain.model.StockAlert;

import java.util.List;
import java.util.Optional;

public interface AlertRepositoryPort {
    StockAlert save(StockAlert alert);
    Optional<StockAlert> findById(Long id);
    List<StockAlert> findUnresolvedByBranchAndProduct(Long branchId, Long productId);
    List<StockAlert> findActiveAlerts(Long branchId);
    List<StockAlert> getGlobalActiveAlerts();
}
