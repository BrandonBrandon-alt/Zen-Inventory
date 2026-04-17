package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "transferencias")
public class TransferEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "estado", nullable = false)
    private String status;

    @Column(name = "fecha_solicitud", nullable = false)
    private LocalDateTime requestDate;

    @Column(name = "fecha_estimada_llegada")
    private LocalDateTime estimatedArrivalDate;

    @Column(name = "fecha_real_llegada")
    private LocalDateTime actualArrivalDate;

    @Column(name = "sucursal_origen_id", nullable = false)
    private Long originBranchId;

    @Column(name = "sucursal_destino_id", nullable = false)
    private Long destinationBranchId;

    @Column(name = "transportista")
    private String carrier;

    @Column(name = "notas_recepcion")
    private String receiptNotes;

    @Column(name = "parent_transfer_id")
    private Long parentTransferId;

    @OneToMany(mappedBy = "transfer", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TransferDetailEntity> details = new ArrayList<>();

    public TransferEntity() {}

    public void addDetail(TransferDetailEntity detail) {
        details.add(detail);
        detail.setTransfer(this);
    }

    public void removeDetail(TransferDetailEntity detail) {
        details.remove(detail);
        detail.setTransfer(null);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public LocalDateTime getRequestDate() { return requestDate; }
    public void setRequestDate(LocalDateTime requestDate) { this.requestDate = requestDate; }

    public LocalDateTime getEstimatedArrivalDate() { return estimatedArrivalDate; }
    public void setEstimatedArrivalDate(LocalDateTime estimatedArrivalDate) { this.estimatedArrivalDate = estimatedArrivalDate; }

    public LocalDateTime getActualArrivalDate() { return actualArrivalDate; }
    public void setActualArrivalDate(LocalDateTime actualArrivalDate) { this.actualArrivalDate = actualArrivalDate; }

    public Long getOriginBranchId() { return originBranchId; }
    public void setOriginBranchId(Long originBranchId) { this.originBranchId = originBranchId; }

    public Long getDestinationBranchId() { return destinationBranchId; }
    public void setDestinationBranchId(Long destinationBranchId) { this.destinationBranchId = destinationBranchId; }

    public String getCarrier() { return carrier; }
    public void setCarrier(String carrier) { this.carrier = carrier; }

    public String getReceiptNotes() { return receiptNotes; }
    public void setReceiptNotes(String receiptNotes) { this.receiptNotes = receiptNotes; }

    public Long getParentTransferId() { return parentTransferId; }
    public void setParentTransferId(Long parentTransferId) { this.parentTransferId = parentTransferId; }

    public List<TransferDetailEntity> getDetails() { return details; }
    public void setDetails(List<TransferDetailEntity> details) { this.details = details; }
}
