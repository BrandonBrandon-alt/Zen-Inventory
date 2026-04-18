package co.com.zenvory.inventario.purchase.domain.model;

import co.com.zenvory.inventario.purchase.domain.exception.InvalidPurchaseStateException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Collections;
import java.util.List;

/**
 * Representa una Orden de Compra ante un proveedor.
 * Maneja el ciclo de vida logístico y financiero.
 */
public class PurchaseOrder {
    private Long id;
    private Long supplierId;
    private Long branchId;
    private Long userId; // Autorizador
    private Long receivingUserId; // Quien recibe la mercancía
    
    private LocalDateTime requestDate;
    private LocalDateTime estimatedArrivalDate;
    private LocalDateTime actualArrivalDate;
    
    private ReceptionStatus receptionStatus;
    private PaymentStatus paymentStatus;
    private Integer paymentDueDays;
    private LocalDateTime paymentDueDate;
    private BigDecimal total;
       private List<PurchaseOrderDetail> details;

    // Campos de Resolución y Auditoría
    private String reasonResolution;
    private Long resolvedById;
    private LocalDateTime resolutionDate;
    private Integer version;

    public PurchaseOrder(Long id, Long supplierId, Long branchId, Long userId, Long receivingUserId,
                         LocalDateTime requestDate, LocalDateTime estimatedArrivalDate, LocalDateTime actualArrivalDate,
                         ReceptionStatus receptionStatus, PaymentStatus paymentStatus, Integer paymentDueDays, 
                         LocalDateTime paymentDueDate, BigDecimal total, List<PurchaseOrderDetail> details,
                         String reasonResolution, Long resolvedById, LocalDateTime resolutionDate, Integer version) {
        if (supplierId == null || branchId == null || userId == null) {
            throw new IllegalArgumentException("Proveedor, Sucursal y Usuario Autorizador son obligatorios.");
        }
        if (details == null || details.isEmpty()) {
            throw new IllegalArgumentException("La orden debe tener al menos un item.");
        }

        this.id = id;
        this.supplierId = supplierId;
        this.branchId = branchId;
        this.userId = userId;
        this.receivingUserId = receivingUserId;
        this.requestDate = (requestDate != null) ? requestDate : LocalDateTime.now();
        this.estimatedArrivalDate = estimatedArrivalDate;
        this.actualArrivalDate = actualArrivalDate;
        this.receptionStatus = (receptionStatus != null) ? receptionStatus : ReceptionStatus.PENDING;
        this.paymentStatus = (paymentStatus != null) ? paymentStatus : PaymentStatus.POR_PAGAR;
        this.paymentDueDays = (paymentDueDays != null) ? paymentDueDays : 30;
        this.paymentDueDate = (paymentDueDate != null) ? paymentDueDate : this.requestDate.plusDays(this.paymentDueDays);
        this.details = details;
        this.total = (total != null) ? total : calculateTotal();
        this.reasonResolution = reasonResolution;
        this.resolvedById = resolvedById;
        this.resolutionDate = resolutionDate;
        this.version = version;
    }

    public static PurchaseOrder create(Long supplierId, Long userId, Long branchId, 
                                     LocalDateTime estimatedArrivalDate, Integer paymentDueDays, List<PurchaseOrderDetail> details) {
        return new PurchaseOrder(null, supplierId, branchId, userId, null, 
                                LocalDateTime.now(), estimatedArrivalDate, null,
                                ReceptionStatus.PENDING, PaymentStatus.POR_PAGAR, paymentDueDays, null, null, details,
                                null, null, null, 0);
    }

    private BigDecimal calculateTotal() {
        return details.stream()
                .map(PurchaseOrderDetail::computeSubtotal)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public void markAsInTransit() {
        if (this.receptionStatus != ReceptionStatus.PENDING) {
            throw new InvalidPurchaseStateException("Solo se puede despachar una orden en estado PENDING.");
        }
        this.receptionStatus = ReceptionStatus.IN_TRANSIT;
    }

    /**
     * Registra la recepción física (total o parcial) de la mercancía.
     * @param userId ID del usuario que recibe físicamente el pedido.
     * @param totalsAreMet Si todas las cantidades cuadran al 100%.
     */
    public void receive(Long userId, boolean totalsAreMet) {
        if (this.receptionStatus == ReceptionStatus.RECEIVED_TOTAL) {
            throw new InvalidPurchaseStateException("La orden ya ha sido recibida completamente.");
        }
        if (this.receptionStatus == ReceptionStatus.CANCELLED) {
            throw new InvalidPurchaseStateException("No se puede recibir una orden cancelada.");
        }
        
        this.receptionStatus = totalsAreMet ? ReceptionStatus.RECEIVED_TOTAL : ReceptionStatus.RECEIVED_PARTIAL;
        this.receivingUserId = userId;
        this.actualArrivalDate = LocalDateTime.now();
    }

    /**
     * Fuerza el cierre de una orden que quedó con faltantes definitivos.
     * @param userId Usuario responsable del cierre (Admin/Manager).
     */
    public void closeShortfall(Long userId) {
        if (this.receptionStatus != ReceptionStatus.RECEIVED_PARTIAL) {
            throw new InvalidPurchaseStateException("Solo se puede liquidar una orden que esté en estado RECEIVED_PARTIAL.");
        }
        this.receptionStatus = ReceptionStatus.RECEIVED_TOTAL;
        this.resolvedById = userId;
        this.resolutionDate = LocalDateTime.now();
        this.reasonResolution = "Cerrado con faltante por decisión administrativa.";
    }

    public void cancel(String reason, Long userId) {
        if (this.receptionStatus != ReceptionStatus.PENDING && this.receptionStatus != ReceptionStatus.IN_TRANSIT) {
            throw new InvalidPurchaseStateException("Solo se pueden cancelar órdenes que no hayan sido recibidas aún.");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("El motivo de cancelación es obligatorio.");
        }
        this.receptionStatus = ReceptionStatus.CANCELLED;
        this.reasonResolution = reason;
        this.resolvedById = userId;
        this.resolutionDate = LocalDateTime.now();
    }

    public void registerPayment() {
        if (this.receptionStatus != ReceptionStatus.RECEIVED_TOTAL && this.receptionStatus != ReceptionStatus.RECEIVED_PARTIAL) {
            throw new InvalidPurchaseStateException("Solo se pueden pagar órdenes que ya han sido recibidas (total o parcialmente).");
        }
        if (this.paymentStatus == PaymentStatus.PAGADO) {
            throw new InvalidPurchaseStateException("La orden ya se encuentra pagada.");
        }
        this.paymentStatus = PaymentStatus.PAGADO;
    }

    // Getters
    public Long getId() { return id; }
    public Long getSupplierId() { return supplierId; }
    public Long getBranchId() { return branchId; }
    public Long getUserId() { return userId; }
    public Long getReceivingUserId() { return receivingUserId; }
    public LocalDateTime getRequestDate() { return requestDate; }
    public LocalDateTime getEstimatedArrivalDate() { return estimatedArrivalDate; }
    public LocalDateTime getActualArrivalDate() { return actualArrivalDate; }
    public ReceptionStatus getReceptionStatus() { return receptionStatus; }
    public PaymentStatus getPaymentStatus() { return paymentStatus; }
    public Integer getPaymentDueDays() { return paymentDueDays; }
    public LocalDateTime getPaymentDueDate() { return paymentDueDate; }
    public BigDecimal getTotal() { return total; }
    public List<PurchaseOrderDetail> getDetails() { return Collections.unmodifiableList(details); }
    public String getReasonResolution() { return reasonResolution; }
    public Long getResolvedById() { return resolvedById; }
    public LocalDateTime getResolutionDate() { return resolutionDate; }
    public Integer getVersion() { return version; }
}
