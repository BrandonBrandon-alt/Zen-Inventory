package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.math.BigDecimal;
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

    @Column(name = "fecha_despacho")
    private LocalDateTime dispatchDate;

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

    @Column(name = "prioridad")
    private String priority;

    @Column(name = "costo_envio")
    private BigDecimal shippingCost;

    @Column(name = "numero_guia")
    private String trackingNumber;

    @Column(name = "motivo_resolucion")
    private String reasonResolution;

    @Column(name = "solicitante_id")
    private Long solicitanteId;

    @Column(name = "solicitante_nombre")
    private String solicitanteNombre;

    @Column(name = "autorizador_id")
    private Long autorizadorId;

    @Column(name = "autorizador_nombre")
    private String autorizadorNombre;

    @Column(name = "despachador_id")
    private Long despachadorId;

    @Column(name = "despachador_nombre")
    private String despachadorNombre;

    @Column(name = "recibidor_id")
    private Long recibidorId;

    @Column(name = "recibidor_nombre")
    private String recibidorNombre;

    @Column(name = "resolutor_id")
    private Long resolutorId;

    @Column(name = "resolutor_nombre")
    private String resolutorNombre;

    @Column(name = "fecha_resolucion")
    private LocalDateTime fechaResolucion;

    @Version
    private Integer version;

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

    public LocalDateTime getDispatchDate() { return dispatchDate; }
    public void setDispatchDate(LocalDateTime dispatchDate) { this.dispatchDate = dispatchDate; }

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

    public String getPriority() { return priority; }
    public void setPriority(String priority) { this.priority = priority; }

    public BigDecimal getShippingCost() { return shippingCost; }
    public void setShippingCost(BigDecimal shippingCost) { this.shippingCost = shippingCost; }

    public String getTrackingNumber() { return trackingNumber; }
    public void setTrackingNumber(String trackingNumber) { this.trackingNumber = trackingNumber; }

    public String getReasonResolution() { return reasonResolution; }
    public void setReasonResolution(String reasonResolution) { this.reasonResolution = reasonResolution; }

    public Long getSolicitanteId() { return solicitanteId; }
    public void setSolicitanteId(Long solicitanteId) { this.solicitanteId = solicitanteId; }

    public String getSolicitanteNombre() { return solicitanteNombre; }
    public void setSolicitanteNombre(String solicitanteNombre) { this.solicitanteNombre = solicitanteNombre; }

    public Long getAutorizadorId() { return autorizadorId; }
    public void setAutorizadorId(Long autorizadorId) { this.autorizadorId = autorizadorId; }

    public String getAutorizadorNombre() { return autorizadorNombre; }
    public void setAutorizadorNombre(String autorizadorNombre) { this.autorizadorNombre = autorizadorNombre; }

    public Long getDespachadorId() { return despachadorId; }
    public void setDespachadorId(Long despachadorId) { this.despachadorId = despachadorId; }

    public String getDespachadorNombre() { return despachadorNombre; }
    public void setDespachadorNombre(String despachadorNombre) { this.despachadorNombre = despachadorNombre; }

    public Long getRecibidorId() { return recibidorId; }
    public void setRecibidorId(Long recibidorId) { this.recibidorId = recibidorId; }

    public String getRecibidorNombre() { return recibidorNombre; }
    public void setRecibidorNombre(String recibidorNombre) { this.recibidorNombre = recibidorNombre; }

    public Long getResolutorId() { return resolutorId; }
    public void setResolutorId(Long resolutorId) { this.resolutorId = resolutorId; }

    public String getResolutorNombre() { return resolutorNombre; }
    public void setResolutorNombre(String resolutorNombre) { this.resolutorNombre = resolutorNombre; }

    public LocalDateTime getFechaResolucion() { return fechaResolucion; }
    public void setFechaResolucion(LocalDateTime fechaResolucion) { this.fechaResolucion = fechaResolucion; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }

    public List<TransferDetailEntity> getDetails() { return details; }
    public void setDetails(List<TransferDetailEntity> details) { this.details = details; }
}
