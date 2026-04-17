package co.com.zenvory.inventario.alert.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.alert.application.port.out.AlertRepositoryPort;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class AlertPersistenceAdapter implements AlertRepositoryPort {

    private final JpaAlertRepository repository;

    public AlertPersistenceAdapter(JpaAlertRepository repository) {
        this.repository = repository;
    }

    @Override
    public StockAlert save(StockAlert alert) {
        AlertEntity entity = toEntity(alert);
        AlertEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<StockAlert> findById(Long id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public List<StockAlert> findUnresolvedByBranchAndProduct(Long branchId, Long productId) {
        return repository.findByBranchIdAndProductIdAndResolvedFalse(branchId, productId)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<StockAlert> findActiveAlerts(Long branchId) {
        return repository.findByBranchIdAndResolvedFalse(branchId)
                .stream().map(this::toDomain).toList();
    }

    @Override
    public List<StockAlert> getGlobalActiveAlerts() {
        return repository.findByResolvedFalse()
                .stream().map(this::toDomain).toList();
    }

    private AlertEntity toEntity(StockAlert domain) {
        AlertEntity entity = new AlertEntity();
        entity.setId(domain.getId());
        entity.setBranchId(domain.getBranchId());
        entity.setProductId(domain.getProductId());
        entity.setMessage(domain.getMessage());
        entity.setAlertDate(domain.getAlertDate());
        entity.setResolved(domain.isResolved());
        entity.setResolutionType(domain.getResolutionType());
        entity.setReferenceId(domain.getReferenceId());
        entity.setResolutionReason(domain.getResolutionReason());
        entity.setResolvedAt(domain.getResolvedAt());
        return entity;
    }

    private StockAlert toDomain(AlertEntity entity) {
        return new StockAlert(
                entity.getId(),
                entity.getBranchId(),
                entity.getProductId(),
                entity.getMessage(),
                entity.getAlertDate(),
                Boolean.TRUE.equals(entity.getResolved()),
                entity.getResolutionType(),
                entity.getReferenceId(),
                entity.getResolutionReason(),
                entity.getResolvedAt()
        );
    }
}
