package co.com.zenvory.inventario.transfer.domain.model;

import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
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
    private final List<TransferPayment> payments = new ArrayList<>();

    // Campos de Logística Avanzada
    private TransferPriority priority;
    private BigDecimal shippingCost;
    private String trackingNumber;

    // Campos de Resolución y Auditoría
    private String reasonResolution;
    private Long solicitanteId;
    private String solicitanteNombre;
    private Long autorizadorId;
    private String autorizadorNombre;
    private Long despachadorId;
    private String despachadorNombre;
    private Long recibidorId;
    private String recibidorNombre;
    private Long resolutorId;
    private String resolutorNombre;
    
    private LocalDateTime resolutionDate;
    private LocalDateTime dispatchDate;
    private Integer version;

    public Transfer(Long id, TransferStatus status, LocalDateTime requestDate, LocalDateTime estimatedArrivalDate, 
                    LocalDateTime actualArrivalDate, Long originBranchId, Long destinationBranchId, 
                    String carrier, String receiptNotes, List<TransferDetail> details, Long parentTransferId,
                    TransferPriority priority, BigDecimal shippingCost, String trackingNumber,
                    String reasonResolution, LocalDateTime resolutionDate, LocalDateTime dispatchDate, Integer version,
                    Long solicitanteId, String solicitanteNombre, Long autorizadorId, String autorizadorNombre,
                    Long despachadorId, String despachadorNombre, Long recibidorId, String recibidorNombre,
                    Long resolutorId, String resolutorNombre) {
        this(id, status, requestDate, estimatedArrivalDate, actualArrivalDate, originBranchId, destinationBranchId, carrier,
                receiptNotes, details, parentTransferId, priority, shippingCost, trackingNumber, reasonResolution,
                resolutionDate, dispatchDate, version, solicitanteId, solicitanteNombre, autorizadorId, autorizadorNombre,
                despachadorId, despachadorNombre, recibidorId, recibidorNombre, resolutorId, resolutorNombre, List.of());
    }

    public Transfer(Long id, TransferStatus status, LocalDateTime requestDate, LocalDateTime estimatedArrivalDate,
                    LocalDateTime actualArrivalDate, Long originBranchId, Long destinationBranchId,
                    String carrier, String receiptNotes, List<TransferDetail> details, Long parentTransferId,
                    TransferPriority priority, BigDecimal shippingCost, String trackingNumber,
                    String reasonResolution, LocalDateTime resolutionDate, LocalDateTime dispatchDate, Integer version,
                    Long solicitanteId, String solicitanteNombre, Long autorizadorId, String autorizadorNombre,
                    Long despachadorId, String despachadorNombre, Long recibidorId, String recibidorNombre,
                    Long resolutorId, String resolutorNombre, List<TransferPayment> payments) {
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
        this.priority = priority != null ? priority : TransferPriority.NORMAL;
        this.shippingCost = shippingCost;
        this.trackingNumber = trackingNumber;
        this.reasonResolution = reasonResolution;
        this.resolutionDate = resolutionDate;
        this.dispatchDate = dispatchDate;
        this.version = version;
        
        this.solicitanteId = solicitanteId;
        this.solicitanteNombre = solicitanteNombre;
        this.autorizadorId = autorizadorId;
        this.autorizadorNombre = autorizadorNombre;
        this.despachadorId = despachadorId;
        this.despachadorNombre = despachadorNombre;
        this.recibidorId = recibidorId;
        this.recibidorNombre = recibidorNombre;
        this.resolutorId = resolutorId;
        this.resolutorNombre = resolutorNombre;
        if (payments != null) {
            this.payments.addAll(payments);
        }
    }

    public static Transfer create(Long originBranchId, Long destinationBranchId, LocalDateTime estimatedArrival, 
                                 List<TransferDetail> details, TransferPriority priority, Long userId, String userName) {
        if (originBranchId != null && originBranchId.equals(destinationBranchId)) {
            throw new IllegalArgumentException("La sucursal de origen y la de destino deben ser distintas.");
        }
        return new Transfer(null, TransferStatus.PENDING, LocalDateTime.now(), estimatedArrival, null, 
                originBranchId, destinationBranchId, null, null, details, null, priority, null, null, null, null, null, null,
                userId, userName, null, null, null, null, null, null, null, null);
    }

    public static Transfer resend(Transfer parent, List<TransferDetail> relativeDetails) {
        return new Transfer(null, TransferStatus.PENDING, LocalDateTime.now(), LocalDateTime.now().plusDays(2), null, 
                parent.getOriginBranchId(), parent.getDestinationBranchId(), null, "REENVÍO AUTOMÁTICO - REF #" + parent.getId(), 
                relativeDetails, parent.getId(), parent.getPriority(), null, null, null, null, null, null,
                null, "SISTEMA", null, null, null, null, null, null, null, null);
    }

    public void approveDestination(Long userId, String userName) {
        if (this.status != TransferStatus.PENDING) {
            throw new InvalidTransferStateException("Solo se puede aprobar en destino una transferencia en estado PENDING.");
        }
        this.status = TransferStatus.APPROVED_DEST;
        this.autorizadorId = userId;
        this.autorizadorNombre = userName;
    }

    public void prepare(Long userId, String userName) {
        if (this.status != TransferStatus.APPROVED_DEST) {
            throw new InvalidTransferStateException("Solo se puede autorizar salida (preparar) una transferencia que ya fue aprobada por destino (APPROVED_DEST).");
        }
        this.status = TransferStatus.PREPARING;
        // Si el autorizador destino no es el mismo que prepara, mantenemos el primero o actualizamos?
        // En este flujo representamos al autorizador final de salida (origen).
        this.autorizadorId = userId;
        this.autorizadorNombre = userName;
    }

    public void dispatch(String carrier, BigDecimal shippingCost, String trackingNumber, LocalDateTime estimatedArrivalDate, Long userId, String userName) {
        if (this.status != TransferStatus.PREPARING) {
            throw new InvalidTransferStateException("Solo se puede despachar una transferencia en estado PREPARING.");
        }
        this.status = TransferStatus.IN_TRANSIT;
        this.dispatchDate = LocalDateTime.now();
        this.carrier = carrier;
        this.shippingCost = shippingCost;
        this.trackingNumber = trackingNumber;
        this.estimatedArrivalDate = estimatedArrivalDate;
        this.despachadorId = userId;
        this.despachadorNombre = userName;
    }

    /**
     * Registra un pago o abono del flete al transportista. Solo hay flete que pagar si el traslado ya se despachó con un
     * costo de envío mayor que cero, y el monto no puede exceder el saldo. Un traslado cancelado o rechazado después de
     * despachado conserva su deuda: el transportista ya hizo el viaje.
     *
     * @param amount monto del pago; si es {@code null} se paga todo el saldo pendiente
     * @return el pago registrado (aún sin id)
     */
    public TransferPayment registerFreightPayment(BigDecimal amount, TransferPaymentMethod method, String reference,
            String notes, Long userId, String userName) {
        if (this.dispatchDate == null || this.shippingCost == null || this.shippingCost.signum() <= 0) {
            throw new InvalidTransferStateException("Este traslado no tiene un flete por pagar: aún no se despacha o salió sin costo de envío.");
        }
        BigDecimal pending = freightBalance();
        if (pending.signum() <= 0) {
            throw new InvalidTransferStateException("El flete de este traslado ya está pagado.");
        }
        BigDecimal paying = (amount != null) ? amount : pending;
        if (paying.signum() <= 0) {
            throw new IllegalArgumentException("El monto del pago debe ser mayor que cero.");
        }
        if (paying.compareTo(pending) > 0) {
            throw new InvalidTransferStateException(
                    "El pago (" + paying.toPlainString() + ") excede el saldo del flete (" + pending.toPlainString() + ").");
        }
        TransferPayment payment = new TransferPayment(null, paying, LocalDateTime.now(), userId, userName, method, reference, notes);
        this.payments.add(payment);
        return payment;
    }

    /** Lo ya pagado del flete. */
    public BigDecimal freightPaid() {
        return payments.stream().map(TransferPayment::getAmount).reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    /** Lo que aún se le debe al transportista; cero si no hay costo de envío o ya se pagó. */
    public BigDecimal freightBalance() {
        if (this.dispatchDate == null || this.shippingCost == null || this.shippingCost.signum() <= 0) {
            return BigDecimal.ZERO;
        }
        return this.shippingCost.subtract(freightPaid()).max(BigDecimal.ZERO);
    }

    public FreightPaymentStatus freightPaymentStatus() {
        if (this.dispatchDate == null || this.shippingCost == null || this.shippingCost.signum() <= 0) {
            return FreightPaymentStatus.SIN_COSTO;
        }
        if (freightBalance().signum() == 0) {
            return FreightPaymentStatus.PAGADO;
        }
        return payments.isEmpty() ? FreightPaymentStatus.POR_PAGAR : FreightPaymentStatus.PAGO_PARCIAL;
    }

    public List<TransferPayment> getPayments() {
        return Collections.unmodifiableList(payments);
    }

    public void receive(String notes, boolean hasIssues, Long userId, String userName) {
        if (this.status != TransferStatus.IN_TRANSIT) {
            throw new InvalidTransferStateException("Solo se puede recibir una transferencia que está IN_TRANSIT.");
        }
        this.status = hasIssues ? TransferStatus.WITH_ISSUE : TransferStatus.DELIVERED;
        this.actualArrivalDate = LocalDateTime.now();
        this.receiptNotes = notes;
        this.recibidorId = userId;
        this.recibidorNombre = userName;
    }

    public void cancel(String reason, Long userId, String userName) {
        if (this.status != TransferStatus.PENDING && this.status != TransferStatus.APPROVED_DEST && this.status != TransferStatus.PREPARING && this.status != TransferStatus.IN_TRANSIT) {
            throw new InvalidTransferStateException("Solo se pueden cancelar transferencias en estados iniciales o en tránsito.");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("El motivo de cancelación es obligatorio.");
        }
        this.status = TransferStatus.CANCELLED;
        this.reasonResolution = reason;
        this.resolutorId = userId;
        this.resolutorNombre = userName;
        this.resolutionDate = LocalDateTime.now();
    }

    public void reject(String reason, Long userId, String userName) {
        if (this.status != TransferStatus.PENDING && this.status != TransferStatus.IN_TRANSIT) {
            throw new InvalidTransferStateException("Solo se pueden rechazar transferencias en estado PENDING o IN_TRANSIT.");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("El motivo de rechazo es obligatorio.");
        }
        this.status = TransferStatus.REJECTED;
        this.reasonResolution = reason;
        this.resolutorId = userId;
        this.resolutorNombre = userName;
        this.resolutionDate = LocalDateTime.now();
    }

    public void resolveAsShrinkage(Long userId, String userName) {
        if (this.status != TransferStatus.WITH_ISSUE) {
            throw new InvalidTransferStateException("Solo se pueden resolver transferencias que tengan novedades.");
        }
        this.status = TransferStatus.DELIVERED;
        this.resolutorId = userId;
        this.resolutorNombre = userName;
        this.resolutionDate = LocalDateTime.now();
    }

    public void resolveAsClaim(Long userId, String userName) {
        if (this.status != TransferStatus.WITH_ISSUE) {
            throw new InvalidTransferStateException("Solo se pueden resolver como reclamo transferencias que tengan novedades.");
        }
        this.status = TransferStatus.UNDER_CLAIM;
        this.resolutorId = userId;
        this.resolutorNombre = userName;
        this.resolutionDate = LocalDateTime.now();
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
    public TransferPriority getPriority() { return priority; }
    public BigDecimal getShippingCost() { return shippingCost; }
    public String getTrackingNumber() { return trackingNumber; }
    public String getReasonResolution() { return reasonResolution; }
    public Long getSolicitanteId() { return solicitanteId; }
    public String getSolicitanteNombre() { return solicitanteNombre; }
    public Long getAutorizadorId() { return autorizadorId; }
    public String getAutorizadorNombre() { return autorizadorNombre; }
    public Long getDespachadorId() { return despachadorId; }
    public String getDespachadorNombre() { return despachadorNombre; }
    public Long getRecibidorId() { return recibidorId; }
    public String getRecibidorNombre() { return recibidorNombre; }
    public Long getResolutorId() { return resolutorId; }
    public String getResolutorNombre() { return resolutorNombre; }
    public LocalDateTime getResolutionDate() { return resolutionDate; }
    public LocalDateTime getDispatchDate() { return dispatchDate; }
    public Integer getVersion() { return version; }
}
