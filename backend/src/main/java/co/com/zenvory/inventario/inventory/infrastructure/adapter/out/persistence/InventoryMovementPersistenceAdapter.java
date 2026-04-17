package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.application.port.out.InventoryMovementRepositoryPort;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

@Component
public class InventoryMovementPersistenceAdapter implements InventoryMovementRepositoryPort {

    private final JpaInventoryMovementRepository movementRepository;

    public InventoryMovementPersistenceAdapter(JpaInventoryMovementRepository movementRepository) {
        this.movementRepository = movementRepository;
    }

    @Override
    public InventoryMovement save(InventoryMovement movement) {
        InventoryMovementEntity entity = InventoryMovementEntity.fromDomain(movement);
        return movementRepository.save(entity).toDomain();
    }

    @Override
    public List<InventoryMovement> findByBranchAndProduct(Long branchId, Long productId) {
        return movementRepository.findByBranchIdAndProductIdOrderByDateDesc(branchId, productId)
                .stream()
                .map(InventoryMovementEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<InventoryMovement> findAll() {
        return movementRepository.findAllByOrderByDateDesc()
                .stream()
                .map(InventoryMovementEntity::toDomain)
                .collect(Collectors.toList());
    }
}
