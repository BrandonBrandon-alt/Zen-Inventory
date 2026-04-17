package co.com.zenvory.inventario.transfer.domain.model;

import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

public class Transfer {
    private Long id;
    private TransferStatus status;
    private LocalDateTime requestDate;
    private LocalDateTime estimatedArrivalDate;
    private LocalDateTime actualArrivalDate;
    private Long originBranchId;
    private Long destinationBranchId;
    private String carrier;
    private String receiptNotes;
    private Long parentTransferId;
    private List<TransferDetail> details;

    public Transfer(Long id, TransferStatus status, LocalDateTime requestDate, LocalDateTime estimatedArrivalDate, LocalDateTime actualArrivalDate, Long originBranchId, Long destinationBranchId, String carrier, String receiptNotes, List<TransferDetail> details, Long parentTransferId) {
        if (originBranchId == null || destinationBranchId == null) {
            throw new IllegalArgumentException("Las sucursales de origen y destino son obligatorias.");
        }
        if (originBranchId.equals(destinationBranchId)) {
            throw new IllegalArgumentException("La sucursal de origen y destino no pueden ser la misma.");
        }
        if (details == null || details.isEmpty()) {
            throw new IllegalArgumentException("La transferencia debe tener al menos un producto.");
        }

        this.id = id;
        this.status = status != null ? status : TransferStatus.PENDING;
        this.requestDate = requestDate != null ? requestDate : LocalDateTime.now();
        this.estimatedArrivalDate = estimatedArrivalDate;
        this.actualArrivalDate = actualArrivalDate;
        this.originBranchId = originBranchId;
        this.destinationBranchId = destinationBranchId;
        this.carrier = carrier;
        this.receiptNotes = receiptNotes;
        this.details = details;
        this.parentTransferId = parentTransferId;
    }

    public static Transfer create(Long originBranchId, Long destinationBranchId, LocalDateTime estimatedArrival, List<TransferDetail> details) {
        return new Transfer(null, TransferStatus.PENDING, LocalDateTime.now(), estimatedArrival, null, originBranchId, destinationBranchId, null, null, details, null);
    }

    public static Transfer resend(Transfer parent, List<TransferDetail> relativeDetails) {
        return new Transfer(null, TransferStatus.PENDING, LocalDateTime.now(), LocalDateTime.now().plusDays(2), null, parent.getOriginBranchId(), parent.getDestinationBranchId(), null, "REENVÍO AUTOMÁTICO - REF #" + parent.getId(), relativeDetails, parent.getId());
    }

    public void prepare() {
        if (this.status != TransferStatus.PENDING) {
            throw new InvalidTransferStateException("Solo se puede preparar una transferencia en estado PENDING.");
        }
        this.status = TransferStatus.PREPARING;
    }

    public void dispatch(String carrier) {
        if (this.status != TransferStatus.PREPARING) {
            throw new InvalidTransferStateException("Solo se puede despachar una transferencia en estado PREPARING.");
        }
        this.status = TransferStatus.IN_TRANSIT;
        this.carrier = carrier;
    }

    public void receive(String notes, boolean hasIssues) {
        if (this.status != TransferStatus.IN_TRANSIT) {
            throw new InvalidTransferStateException("Solo se puede recibir una transferencia que está IN_TRANSIT.");
        }
        this.status = hasIssues ? TransferStatus.WITH_ISSUE : TransferStatus.DELIVERED;
        this.actualArrivalDate = LocalDateTime.now();
        this.receiptNotes = notes;
    }

    public void cancel() {
        if (this.status != TransferStatus.PENDING && this.status != TransferStatus.PREPARING) {
            throw new InvalidTransferStateException("Solo se pueden cancelar transferencias en estado PENDING o PREPARING.");
        }
        this.status = TransferStatus.CANCELLED;
    }

    public void resolveAsShrinkage() {
        if (this.status != TransferStatus.WITH_ISSUE) {
            throw new InvalidTransferStateException("Solo se pueden resolver transferencias que tengan novedades.");
        }
        this.status = TransferStatus.DELIVERED;
    }

    public void resolveAsClaim() {
        if (this.status != TransferStatus.WITH_ISSUE) {
            throw new InvalidTransferStateException("Solo se pueden resolver como reclamo transferencias que tengan novedades.");
        }
        this.status = TransferStatus.UNDER_CLAIM;
    }

    public Long getId() { return id; }
    public TransferStatus getStatus() { return status; }
    public LocalDateTime getRequestDate() { return requestDate; }
    public LocalDateTime getEstimatedArrivalDate() { return estimatedArrivalDate; }
    public LocalDateTime getActualArrivalDate() { return actualArrivalDate; }
    public Long getOriginBranchId() { return originBranchId; }
    public Long getDestinationBranchId() { return destinationBranchId; }
    public String getCarrier() { return carrier; }
    public String getReceiptNotes() { return receiptNotes; }
    public Long getParentTransferId() { return parentTransferId; }
    public List<TransferDetail> getDetails() { return Collections.unmodifiableList(details); }
}
