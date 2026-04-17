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

        if (domain.getDetails() != null) {
            for (TransferDetail detail : domain.getDetails()) {
                TransferDetailEntity detailEntity = new TransferDetailEntity();
                detailEntity.setId(detail.getId());
                detailEntity.setProductId(detail.getProductId());
                detailEntity.setRequestedQuantity(detail.getRequestedQuantity());
                detailEntity.setSentQuantity(detail.getSentQuantity());
                detailEntity.setReceivedQuantity(detail.getReceivedQuantity());
                detailEntity.setMissingQuantity(detail.getMissingQuantity());

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
                        d.getRequestedQuantity(),
                        d.getSentQuantity(),
                        d.getReceivedQuantity(),
                        d.getMissingQuantity()
                )).collect(Collectors.toList()),
                entity.getParentTransferId()
        );
    }
}
