package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.transfer.application.port.out.TransferRepositoryPort;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import co.com.zenvory.inventario.transfer.domain.model.TransferDetail;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class TransferPersistenceAdapter implements TransferRepositoryPort {

    private final JpaTransferRepository jpaTransferRepository;

    public TransferPersistenceAdapter(JpaTransferRepository jpaTransferRepository) {
        this.jpaTransferRepository = jpaTransferRepository;
    }

    @Override
    public Transfer save(Transfer transfer) {
        TransferEntity entity = toEntity(transfer);
        TransferEntity savedEntity = jpaTransferRepository.save(entity);
        return toDomain(savedEntity);
    }

    @Override
    public Optional<Transfer> findById(Long id) {
        return jpaTransferRepository.findById(id).map(this::toDomain);
    }

    @Override
    public List<Transfer> findAll() {
        return jpaTransferRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public List<Transfer> findByBranch(Long branchId) {
        return jpaTransferRepository.findByOriginBranchIdOrDestinationBranchIdOrderByIdDesc(branchId, branchId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    private TransferEntity toEntity(Transfer domain) {
        TransferEntity entity = new TransferEntity();
        entity.setId(domain.getId());
        entity.setStatus(domain.getStatus().name());
        entity.setRequestDate(domain.getRequestDate());
        entity.setEstimatedArrivalDate(domain.getEstimatedArrivalDate());
        entity.setActualArrivalDate(domain.getActualArrivalDate());
        entity.setOriginBranchId(domain.getOriginBranchId());
        entity.setDestinationBranchId(domain.getDestinationBranchId());
        entity.setCarrier(domain.getCarrier());
        entity.setReceiptNotes(domain.getReceiptNotes());
        entity.setParentTransferId(domain.getParentTransferId());
        entity.setReasonResolution(domain.getReasonResolution());
        entity.setSolicitanteId(domain.getSolicitanteId());
        entity.setSolicitanteNombre(domain.getSolicitanteNombre());
        entity.setAutorizadorId(domain.getAutorizadorId());
        entity.setAutorizadorNombre(domain.getAutorizadorNombre());
        entity.setDespachadorId(domain.getDespachadorId());
        entity.setDespachadorNombre(domain.getDespachadorNombre());
        entity.setRecibidorId(domain.getRecibidorId());
        entity.setRecibidorNombre(domain.getRecibidorNombre());
        entity.setResolutorId(domain.getResolutorId());
        entity.setResolutorNombre(domain.getResolutorNombre());
        entity.setFechaResolucion(domain.getResolutionDate());
        entity.setVersion(domain.getVersion());
        entity.setPriority(domain.getPriority() != null ? domain.getPriority().name() : null);
        entity.setShippingCost(domain.getShippingCost());
        entity.setTrackingNumber(domain.getTrackingNumber());
        entity.setDispatchDate(domain.getDispatchDate());

        if (domain.getDetails() != null) {
            for (TransferDetail detail : domain.getDetails()) {
                TransferDetailEntity detailEntity = new TransferDetailEntity();
                detailEntity.setId(detail.getId());
                detailEntity.setProductId(detail.getProductId());
                detailEntity.setRequestedQuantity(detail.getRequestedQuantity());
                detailEntity.setSentQuantity(detail.getSentQuantity());
                detailEntity.setReceivedQuantity(detail.getReceivedQuantity());
                detailEntity.setMissingQuantity(detail.getMissingQuantity());
                detailEntity.setProductName(detail.getProductName());

                entity.addDetail(detailEntity);
            }
        }
        return entity;
    }

    private Transfer toDomain(TransferEntity entity) {
        return new Transfer(
                entity.getId(),
                TransferStatus.valueOf(entity.getStatus()),
                entity.getRequestDate(),
                entity.getEstimatedArrivalDate(),
                entity.getActualArrivalDate(),
                entity.getOriginBranchId(),
                entity.getDestinationBranchId(),
                entity.getCarrier(),
                entity.getReceiptNotes(),
                entity.getDetails().stream().map(d -> new TransferDetail(
                        d.getId(),
                        d.getProductId(),
                        d.getProductName(),
                        d.getRequestedQuantity(),
                        d.getSentQuantity(),
                        d.getReceivedQuantity(),
                        d.getMissingQuantity()
                )).collect(Collectors.toList()),
                entity.getParentTransferId(),
                entity.getPriority() != null ? co.com.zenvory.inventario.transfer.domain.model.TransferPriority.valueOf(entity.getPriority()) : null,
                entity.getShippingCost(),
                entity.getTrackingNumber(),
                entity.getReasonResolution(),
                entity.getFechaResolucion(),
                entity.getDispatchDate(),
                entity.getVersion(),
                entity.getSolicitanteId(),
                entity.getSolicitanteNombre(),
                entity.getAutorizadorId(),
                entity.getAutorizadorNombre(),
                entity.getDespachadorId(),
                entity.getDespachadorNombre(),
                entity.getRecibidorId(),
                entity.getRecibidorNombre(),
                entity.getResolutorId(),
                entity.getResolutorNombre()
        );
    }
}
