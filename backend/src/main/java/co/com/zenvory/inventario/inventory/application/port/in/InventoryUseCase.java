package co.com.zenvory.inventario.inventory.application.port.in;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;

import java.math.BigDecimal;
import java.util.List;

public interface InventoryUseCase {
    
    LocalInventory getInventory(Long branchId, Long productId);
    
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

    void reserveStock(Long branchId, Long productId, BigDecimal quantity);
    
    void releaseStock(Long branchId, Long productId, BigDecimal quantity);

    List<LocalInventory> getInventoryByBranch(Long branchId);

    List<co.com.zenvory.inventario.inventory.domain.model.LocalInventoryEnriched> getEnrichedInventoryByBranch(Long branchId);

    LocalInventory updateMinimumStock(Long branchId, Long productId, BigDecimal minimumStock);

    List<InventoryMovement> getKardex(Long branchId, Long productId);

    List<LocalInventory> getLowStockInventories();

    List<InventoryMovement> getAllMovements();
    List<InventoryMovement> getMovementsByBranch(Long branchId);
}
