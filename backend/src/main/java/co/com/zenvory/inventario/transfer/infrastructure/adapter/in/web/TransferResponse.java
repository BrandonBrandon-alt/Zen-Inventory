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
        LocalDateTime dispatchDate,
        Long originBranchId,
        Long destinationBranchId,
        String carrier,
        String receiptNotes,
        Long parentTransferId,
        String priority,
        java.math.BigDecimal shippingCost,
        String trackingNumber,
        String reasonResolution,
        Long solicitanteId,
        String solicitanteNombre,
        Long autorizadorId,
        String autorizadorNombre,
        Long despachadorId,
        String despachadorNombre,
        Long recibidorId,
        String recibidorNombre,
        Long resolutorId,
        String resolutorNombre,
        List<TransferDetailResponse> details
) {
    public record TransferDetailResponse(
            Long id,
            Long productId,
            String productName,
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
                transfer.getDispatchDate(),
                transfer.getOriginBranchId(),
                transfer.getDestinationBranchId(),
                transfer.getCarrier(),
                transfer.getReceiptNotes(),
                transfer.getParentTransferId(),
                transfer.getPriority() != null ? transfer.getPriority().name() : null,
                transfer.getShippingCost(),
                transfer.getTrackingNumber(),
                transfer.getReasonResolution(),
                transfer.getSolicitanteId(),
                transfer.getSolicitanteNombre(),
                transfer.getAutorizadorId(),
                transfer.getAutorizadorNombre(),
                transfer.getDespachadorId(),
                transfer.getDespachadorNombre(),
                transfer.getRecibidorId(),
                transfer.getRecibidorNombre(),
                transfer.getResolutorId(),
                transfer.getResolutorNombre(),
                transfer.getDetails().stream().map(d -> new TransferDetailResponse(
                        d.getId(),
                        d.getProductId(),
                        d.getProductName(),
                        d.getRequestedQuantity(),
                        d.getSentQuantity(),
                        d.getReceivedQuantity(),
                        d.getMissingQuantity()
                )).toList()
        );
    }
}
