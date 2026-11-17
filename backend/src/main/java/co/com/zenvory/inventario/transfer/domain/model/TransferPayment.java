package co.com.zenvory.inventario.transfer.domain.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un pago o abono del flete de un traslado. Es inmutable: un pago equivocado no se edita ni se borra; se anula ({@link #voided}) y deja de contar; queda como rastro de auditoría.
 * El nombre de quien lo registró se guarda como «foto».
 */
public class TransferPayment {
    private final Long id;
    private final BigDecimal amount;
    private final LocalDateTime date;
    private final Long userId;
    private final String userName;
    private final TransferPaymentMethod method;
    private final String reference;
    private final String notes;
    /** Anulación (contra-asiento): todos nulos si el pago está vigente. */
    private final LocalDateTime voidedAt;
    private final Long voidedByUserId;
    private final String voidedByUserName;
    private final String voidReason;

    public TransferPayment(Long id, BigDecimal amount, LocalDateTime date, Long userId, String userName,
            TransferPaymentMethod method, String reference, String notes) {
        this(id, amount, date, userId, userName, method, reference, notes, null, null, null, null);
    }

    public TransferPayment(Long id, BigDecimal amount, LocalDateTime date, Long userId, String userName,
            TransferPaymentMethod method, String reference, String notes, LocalDateTime voidedAt, Long voidedByUserId,
            String voidedByUserName, String voidReason) {
        if (amount == null || amount.signum() <= 0) {
            throw new IllegalArgumentException("El monto del pago debe ser mayor que cero.");
        }
        if (userId == null) {
            throw new IllegalArgumentException("El pago debe registrar quién lo hizo.");
        }
        this.id = id;
        this.amount = amount;
        this.date = date != null ? date : LocalDateTime.now();
        this.userId = userId;
        this.userName = userName;
        this.method = method != null ? method : TransferPaymentMethod.OTRO;
        this.reference = reference == null || reference.isBlank() ? null : reference.trim();
        this.notes = notes == null || notes.isBlank() ? null : notes.trim();
        this.voidedAt = voidedAt;
        this.voidedByUserId = voidedByUserId;
        this.voidedByUserName = voidedByUserName;
        this.voidReason = voidReason;
    }

    /**
     * Este mismo pago, anulado: no se edita el original (queda el rastro de lo que se registró), se marca con quién,
     * cuándo y por qué. El motivo es obligatorio.
     */
    public TransferPayment voided(String reason, Long userId, String userName) {
        if (isVoided()) {
            throw new IllegalStateException("Este pago ya está anulado.");
        }
        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("Escribe el motivo de la anulación.");
        }
        if (userId == null) {
            throw new IllegalArgumentException("La anulación debe registrar quién la hizo.");
        }
        return new TransferPayment(id, amount, date, this.userId, this.userName, method, reference, notes, LocalDateTime.now(), userId,
                userName, reason.trim());
    }

    public boolean isVoided() { return voidedAt != null; }

    public Long getId() { return id; }
    public BigDecimal getAmount() { return amount; }
    public LocalDateTime getDate() { return date; }
    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public TransferPaymentMethod getMethod() { return method; }
    public String getReference() { return reference; }
    public String getNotes() { return notes; }
    public LocalDateTime getVoidedAt() { return voidedAt; }
    public Long getVoidedByUserId() { return voidedByUserId; }
    public String getVoidedByUserName() { return voidedByUserName; }
    public String getVoidReason() { return voidReason; }
}
