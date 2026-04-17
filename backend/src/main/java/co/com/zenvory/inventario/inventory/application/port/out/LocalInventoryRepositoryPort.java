package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

public interface LocalInventoryRepositoryPort {
    Optional<LocalInventory> findByBranchAndProduct(Long branchId, Long productId);
    LocalInventory save(LocalInventory localInventory);
    List<LocalInventory> findByBranchId(Long branchId);
    List<LocalInventory> findLowStock();
    BigDecimal sumQuantityByProductId(Long productId);
}
