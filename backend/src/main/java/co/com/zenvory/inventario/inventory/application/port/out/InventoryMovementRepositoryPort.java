package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import java.util.List;

public interface InventoryMovementRepositoryPort {
    InventoryMovement save(InventoryMovement movement);
    List<InventoryMovement> findByBranchAndProduct(Long branchId, Long productId);
    List<InventoryMovement> findAll();
}
