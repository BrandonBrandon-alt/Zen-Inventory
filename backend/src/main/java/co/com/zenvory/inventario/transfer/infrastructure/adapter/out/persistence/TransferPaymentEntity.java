package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Pago o abono del flete de un traslado ({@code pagos_traslado}). Inmutable: solo se inserta. */
@Entity
@Table(name = "pagos_traslado")
public class TransferPaymentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "traslado_id", nullable = false)
    private TransferEntity transfer;

    @Column(name = "monto", nullable = false, precision = 12, scale = 2)
    private BigDecimal amount;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime date;

    @Column(name = "usuario_id", nullable = false)
    private Long userId;

    @Column(name = "usuario_nombre", nullable = false)
    private String userName;

    @Column(name = "metodo", nullable = false)
    private String method;

    @Column(name = "referencia")
    private String reference;

    @Column(name = "notas")
    private String notes;

    public TransferPaymentEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public TransferEntity getTransfer() { return transfer; }
    public void setTransfer(TransferEntity transfer) { this.transfer = transfer; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }
    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }
    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public String getReference() { return reference; }
    public void setReference(String reference) { this.reference = reference; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
