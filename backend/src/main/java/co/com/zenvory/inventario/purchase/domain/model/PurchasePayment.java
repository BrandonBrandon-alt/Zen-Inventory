package co.com.zenvory.inventario.purchase.domain.model;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Un pago o abono hecho al proveedor por una orden de compra. Es inmutable: un pago equivocado no se edita,
 * queda como rastro de auditoría. El nombre de quien lo registró se guarda como «foto».
 */
public class PurchasePayment {
    private final Long id;
    private final BigDecimal amount;
    private final LocalDateTime date;
    private final Long userId;
    private final String userName;
    private final PaymentMethod method;
    private final String reference;
    private final String notes;

    public PurchasePayment(Long id, BigDecimal amount, LocalDateTime date, Long userId, String userName,
            PaymentMethod method, String reference, String notes) {
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
        this.method = method != null ? method : PaymentMethod.OTRO;
        this.reference = reference == null || reference.isBlank() ? null : reference.trim();
        this.notes = notes == null || notes.isBlank() ? null : notes.trim();
    }

    public Long getId() { return id; }
    public BigDecimal getAmount() { return amount; }
    public LocalDateTime getDate() { return date; }
    public Long getUserId() { return userId; }
    public String getUserName() { return userName; }
    public PaymentMethod getMethod() { return method; }
    public String getReference() { return reference; }
    public String getNotes() { return notes; }
}
