package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Pago o abono de una orden de compra ({@code pagos_orden_compra}). Inmutable: solo se inserta. */
@Entity
@Table(name = "pagos_orden_compra")
public class PurchasePaymentEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "orden_id", nullable = false)
    private PurchaseOrderEntity purchaseOrder;

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

    public PurchasePaymentEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public PurchaseOrderEntity getPurchaseOrder() { return purchaseOrder; }
    public void setPurchaseOrder(PurchaseOrderEntity purchaseOrder) { this.purchaseOrder = purchaseOrder; }

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
