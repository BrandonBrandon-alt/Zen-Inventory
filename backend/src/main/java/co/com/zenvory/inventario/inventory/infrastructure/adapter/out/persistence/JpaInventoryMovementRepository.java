package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface JpaInventoryMovementRepository extends JpaRepository<InventoryMovementEntity, Long> {
    List<InventoryMovementEntity> findByBranchIdAndProductIdOrderByDateDesc(Long branchId, Long productId);
    List<InventoryMovementEntity> findAllByOrderByDateDesc();
}
