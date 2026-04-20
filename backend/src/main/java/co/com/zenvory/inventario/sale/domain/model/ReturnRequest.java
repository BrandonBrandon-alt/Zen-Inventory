package co.com.zenvory.inventario.sale.domain.model;

import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * Agregado raíz que representa una solicitud de devolución de productos.
 * Utiliza un flujo de aprobación jerárquica: Seller solicita, Manager aprueba.
 */
public class ReturnRequest {
    private Long id;
    private Long saleId;
    private Long branchId;
    private Long requesterId; // Seller
    private Long approverId;  // Manager (null hasta resolución)
    
    private ReturnRequestStatus status;
    private String generalReason;
    private String approverComment;
    
    private LocalDateTime requestDate;
    private LocalDateTime processingDate;
    
    private List<ReturnRequestDetail> details;

    public ReturnRequest(Long id, Long saleId, Long branchId, Long requesterId, Long approverId,
                         ReturnRequestStatus status, String generalReason, String approverComment,
                         LocalDateTime requestDate, LocalDateTime processingDate, List<ReturnRequestDetail> details) {
        
        if (saleId == null || branchId == null || requesterId == null) {
            throw new IllegalArgumentException("Venta, Sucursal y Solicitante son campos obligatorios.");
        }
        if (details == null || details.isEmpty()) {
            throw new IllegalArgumentException("La solicitud debe contener al menos un producto.");
        }
        if (generalReason == null || generalReason.isBlank()) {
            throw new IllegalArgumentException("El motivo general de la devolución es obligatorio.");
        }

        this.id = id;
        this.saleId = saleId;
        this.branchId = branchId;
        this.requesterId = requesterId;
        this.approverId = approverId;
        this.status = (status != null) ? status : ReturnRequestStatus.PENDIENTE;
        this.generalReason = generalReason;
        this.approverComment = approverComment;
        this.requestDate = (requestDate != null) ? requestDate : LocalDateTime.now();
        this.processingDate = processingDate;
        this.details = details;
    }

    public static ReturnRequest create(Long saleId, Long branchId, Long requesterId, String reason, List<ReturnRequestDetail> details) {
        return new ReturnRequest(null, saleId, branchId, requesterId, null, 
                                 ReturnRequestStatus.PENDIENTE, reason, null, 
                                 LocalDateTime.now(), null, details);
    }

    /**
     * El Manager aprueba la solicitud.
     */
    public void approve(Long managerId, String comment) {
        if (this.status != ReturnRequestStatus.PENDIENTE) {
            throw new IllegalStateException("Solo se pueden aprobar solicitudes en estado PENDIENTE.");
        }
        this.status = ReturnRequestStatus.APROBADA;
        this.approverId = managerId;
        this.approverComment = comment;
        this.processingDate = LocalDateTime.now();
    }

    /**
     * El Manager rechaza la solicitud.
     */
    public void reject(Long managerId, String reason) {
        if (this.status != ReturnRequestStatus.PENDIENTE) {
            throw new IllegalStateException("Solo se pueden rechazar solicitudes en estado PENDIENTE.");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Debe proporcionar un motivo para el rechazo.");
        }
        this.status = ReturnRequestStatus.RECHAZADA;
        this.approverId = managerId;
        this.approverComment = reason;
        this.processingDate = LocalDateTime.now();
    }

    // Getters
    public Long getId() { return id; }
    public Long getSaleId() { return saleId; }
    public Long getBranchId() { return branchId; }
    public Long getRequesterId() { return requesterId; }
    public Long getApproverId() { return approverId; }
    public ReturnRequestStatus getStatus() { return status; }
    public String getGeneralReason() { return generalReason; }
    public String getApproverComment() { return approverComment; }
    public LocalDateTime getRequestDate() { return requestDate; }
    public LocalDateTime getProcessingDate() { return processingDate; }
    public List<ReturnRequestDetail> getDetails() { return Collections.unmodifiableList(details); }
}
