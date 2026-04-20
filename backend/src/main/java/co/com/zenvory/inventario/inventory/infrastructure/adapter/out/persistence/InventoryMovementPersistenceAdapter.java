package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.application.port.out.InventoryMovementRepositoryPort;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de persistencia (Output Adapter) para el historial de movimientos de inventario.
 * 
 * <p>Implementa el puerto {@link InventoryMovementRepositoryPort} utilizando Spring Data JPA.
 * Se encarga de la traducción entre el modelo de dominio {@link InventoryMovement} 
 * y la entidad de persistencia {@link InventoryMovementEntity}, garantizando que 
 * la lógica de negocio permanezca agnóstica a los detalles de base de datos.</p>
 */
@Component
public class InventoryMovementPersistenceAdapter implements InventoryMovementRepositoryPort {

    /** Repositorio JPA de bajo nivel para movimientos. */
    private final JpaInventoryMovementRepository movementRepository;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param movementRepository Implementación del repositorio Spring Data.
     */
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

    @Override
    public List<InventoryMovement> findByBranchId(Long branchId) {
        return movementRepository.findByBranchIdOrderByDateDesc(branchId)
                .stream()
                .map(InventoryMovementEntity::toDomain)
                .collect(Collectors.toList());
    }
}
