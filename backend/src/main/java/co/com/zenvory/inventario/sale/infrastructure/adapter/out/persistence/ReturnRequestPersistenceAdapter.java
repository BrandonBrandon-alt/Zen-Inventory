package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.application.port.out.ReturnRequestRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestDetail;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class ReturnRequestPersistenceAdapter implements ReturnRequestRepositoryPort {

    private final JpaReturnRequestRepository repository;

    @PersistenceContext
    private EntityManager entityManager;

    public ReturnRequestPersistenceAdapter(JpaReturnRequestRepository repository) {
        this.repository = repository;
    }

    @Override
    public ReturnRequest save(ReturnRequest request) {
        ReturnRequestEntity entity = toEntity(request);
        ReturnRequestEntity saved = repository.save(entity);
        return toDomain(saved);
    }

    @Override
    public Optional<ReturnRequest> findById(Long id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public Optional<ReturnRequest> findByIdForUpdate(Long id) {
        // Primero el bloqueo y después la lectura. Un refresh o una consulta con bloqueo no sirven aquí: al traer los
        // detalles con JOIN, Hibernate lee antes de bloquear (follow-on locking) y validaría un estado viejo. El refresh es
        // porque el controlador ya leyó la entidad en esta sesión (open-in-view) y findById devolvería esa copia.
        if (repository.lockById(id).isEmpty()) {
            return Optional.empty();
        }
        return repository.findById(id).map(entity -> {
            entityManager.refresh(entity);
            return toDomain(entity);
        });
    }

    @Override
    public List<ReturnRequest> findByBranchId(Long branchId) {
        return repository.findBySucursalId(branchId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<ReturnRequest> findBySaleId(Long saleId) {
        return repository.findByVentaId(saleId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<ReturnRequest> findBySaleIdAndStatus(Long saleId, ReturnRequestStatus status) {
        return repository.findByVentaIdAndEstado(saleId, status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<ReturnRequest> findByBranchIdAndStatus(Long branchId, ReturnRequestStatus status) {
        return repository.findBySucursalIdAndEstado(branchId, status).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<ReturnRequest> findAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private ReturnRequestEntity toEntity(ReturnRequest domain) {
        ReturnRequestEntity entity = ReturnRequestEntity.builder()
                .id(domain.getId())
                .ventaId(domain.getSaleId())
                .sucursalId(domain.getBranchId())
                .solicitanteId(domain.getRequesterId())
                .aprobadorId(domain.getApproverId())
                .estado(domain.getStatus())
                .fechaSolicitud(domain.getRequestDate())
                .fechaProcesamiento(domain.getProcessingDate())
                .motivoGeneral(domain.getGeneralReason())
                .comentarioAprobador(domain.getApproverComment())
                .build();

        List<ReturnRequestDetailEntity> details = domain.getDetails().stream()
                .map(d -> ReturnRequestDetailEntity.builder()
                        .id(d.getId())
                        .request(entity)
                        .saleDetailId(d.getSaleDetailId())
                        .productId(d.getProductId())
                        .cantidad(d.getQuantity())
                        .motivoEspecifico(d.getReasonSpecific())
                        .precioUnidadVenta(d.getUnitPricePaid())
                        .build())
                .collect(Collectors.toList());
        
        entity.setDetails(details);
        return entity;
    }

    private ReturnRequest toDomain(ReturnRequestEntity entity) {
        List<ReturnRequestDetail> details = entity.getDetails().stream()
                .map(e -> new ReturnRequestDetail(
                        e.getId(),
                        e.getSaleDetailId(),
                        e.getProductId(),
                        e.getCantidad(),
                        e.getMotivoEspecifico(),
                        e.getPrecioUnidadVenta()))
                .collect(Collectors.toList());

        return new ReturnRequest(
                entity.getId(),
                entity.getVentaId(),
                entity.getSucursalId(),
                entity.getSolicitanteId(),
                entity.getAprobadorId(),
                entity.getEstado(),
                entity.getMotivoGeneral(),
                entity.getComentarioAprobador(),
                entity.getFechaSolicitud(),
                entity.getFechaProcesamiento(),
                details);
    }
}
