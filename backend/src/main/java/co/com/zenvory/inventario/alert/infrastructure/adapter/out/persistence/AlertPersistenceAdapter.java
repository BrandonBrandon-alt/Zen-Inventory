package co.com.zenvory.inventario.alert.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.alert.application.port.out.AlertRepositoryPort;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

/**
 * Adaptador de salida (Secondary Adapter) para la persistencia de alertas.
 * 
 * <p>Implementa la interfaz {@code AlertRepositoryPort} y actúa como puente 
 * entre la capa de aplicación y el repositorio de datos (JPA).</p>
 * 
 * <p>Responsabilidad: Realizar la traducción (mapping) entre objetos de 
 * dominio {@code StockAlert} y entidades de persistencia {@code AlertEntity}.</p>
 */
@Component
public class AlertPersistenceAdapter implements AlertRepositoryPort {

    private final JpaAlertRepository repository;

    /**
     * Inyección del repositorio de Spring Data JPA.
     * @param repository Interfaz de bajo nivel para operaciones SQL.
     */
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

    /**
     * Convierte un objeto de dominio a una entidad de persistencia.
     * 
     * @param domain Modelo de dominio.
     * @return Entidad JPA lista para ser guardada.
     */
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
        entity.setType(domain.getType());
        return entity;
    }

    /**
     * Convierte una entidad de persistencia a un objeto de dominio.
     * 
     * @param entity Entidad recuperada de la base de datos.
     * @return Modelo de dominio con lógica de negocio.
     */
    private StockAlert toDomain(AlertEntity entity) {
        return new StockAlert(
                entity.getId(),
                entity.getBranchId(),
                entity.getProductId(),
                entity.getMessage(),
                entity.getAlertDate(),
                Boolean.TRUE.equals(entity.getResolved()),
                entity.getResolutionType(),
                entity.getType(),
                entity.getReferenceId(),
                entity.getResolutionReason(),
                entity.getResolvedAt()
        );
    }
}
