package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.transfer.domain.model.Transfer;

import java.time.LocalDateTime;
import java.util.List;

public record TransferResponse(
        Long id,
        String status,
        LocalDateTime requestDate,
        LocalDateTime estimatedArrivalDate,
        LocalDateTime actualArrivalDate,
        Long originBranchId,
        Long destinationBranchId,
        String carrier,
        String receiptNotes,
        Long parentTransferId,
        String reasonResolution,
        List<TransferDetailResponse> details
) {
    public record TransferDetailResponse(
            Long id,
            Long productId,
            Integer requestedQuantity,
            Integer sentQuantity,
            Integer receivedQuantity,
            Integer missingQuantity
    ) {}

    public static TransferResponse fromDomain(Transfer transfer) {
        return new TransferResponse(
                transfer.getId(),
                transfer.getStatus().name(),
                transfer.getRequestDate(),
                transfer.getEstimatedArrivalDate(),
                transfer.getActualArrivalDate(),
                transfer.getOriginBranchId(),
                transfer.getDestinationBranchId(),
                transfer.getCarrier(),
                transfer.getReceiptNotes(),
                transfer.getParentTransferId(),
                transfer.getReasonResolution(),
                transfer.getDetails().stream().map(d -> new TransferDetailResponse(
                        d.getId(),
                        d.getProductId(),
                        d.getRequestedQuantity(),
                        d.getSentQuantity(),
                        d.getReceivedQuantity(),
                        d.getMissingQuantity()
                )).toList()
        );
    }
}
