package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.application.port.out.LocalInventoryRepositoryPort;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Adaptador de persistencia (Output Adapter) para la gestión de saldos de inventario local.
 * 
 * <p>Implementa el puerto {@link LocalInventoryRepositoryPort} interactuando con 
 * el repositorio JPA {@link JpaLocalInventoryRepository}. Proporciona las 
 * capacidades de almacenamiento y consulta de existencias físicas por ubicación, 
 * traduciendo entre el dominio y la persistencia.</p>
 */
@Component
public class LocalInventoryPersistenceAdapter implements LocalInventoryRepositoryPort {

    /** Repositorio JPA de bajo nivel para inventarios locales. */
    private final JpaLocalInventoryRepository localInventoryRepository;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param localInventoryRepository Implementación del repositorio Spring Data.
     */
    public LocalInventoryPersistenceAdapter(JpaLocalInventoryRepository localInventoryRepository) {
        this.localInventoryRepository = localInventoryRepository;
    }


    @Override
    public Optional<LocalInventory> findByBranchAndProduct(Long branchId, Long productId) {
        return localInventoryRepository.findByBranchIdAndProductId(branchId, productId)
                .map(LocalInventoryEntity::toDomain);
    }

    @Override
    public LocalInventory save(LocalInventory localInventory) {
        LocalInventoryEntity entity = LocalInventoryEntity.fromDomain(localInventory);
        return localInventoryRepository.save(entity).toDomain();
    }

    @Override
    public List<LocalInventory> findByBranchId(Long branchId) {
        return localInventoryRepository.findByBranchId(branchId).stream()
                .map(LocalInventoryEntity::toDomain)
                .toList();
    }

    @Override
    public java.util.List<LocalInventory> findLowStock() {
        return localInventoryRepository.findLowStock().stream()
                .map(LocalInventoryEntity::toDomain)
                .toList();
    }

    @Override
    public java.math.BigDecimal sumQuantityByProductId(Long productId) {
        return localInventoryRepository.sumQuantityByProductId(productId);
    }
}
