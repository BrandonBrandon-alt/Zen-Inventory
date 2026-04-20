package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.application.port.out.ReturnRequestRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestDetail;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class ReturnRequestPersistenceAdapter implements ReturnRequestRepositoryPort {

    private final JpaReturnRequestRepository repository;

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
