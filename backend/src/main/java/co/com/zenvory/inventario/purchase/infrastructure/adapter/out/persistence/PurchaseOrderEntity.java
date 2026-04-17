package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ordenes_compra")
public class PurchaseOrderEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "proveedor_id", nullable = false)
    private Long supplierId;

    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    @Column(name = "usuario_id", nullable = false)
    private Long userId;

    @Column(name = "usuario_recepcion_id")
    private Long receivingUserId;

    @Column(name = "fecha_solicitud", nullable = false)
    private LocalDateTime requestDate;

    @Column(name = "fecha_estimada_llegada")
    private LocalDateTime estimatedArrivalDate;

    @Column(name = "fecha_real_llegada")
    private LocalDateTime actualArrivalDate;

    @Column(name = "estado_recepcion", nullable = false)
    private String receptionStatus;

    @Column(name = "estado_pago", nullable = false)
    private String paymentStatus;

    @Column(name = "total", nullable = false)
    private java.math.BigDecimal total;

    @Column(name = "fecha_vencimiento_pago")
    private LocalDateTime paymentDueDate;

    @Column(name = "plazo_pago_dias", nullable = false)
    private Integer paymentDueDays;

    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseDetailEntity> details = new ArrayList<>();

    public PurchaseOrderEntity() {}

    public void addDetail(PurchaseDetailEntity detail) {
        details.add(detail);
        detail.setPurchaseOrder(this);
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getSupplierId() { return supplierId; }
    public void setSupplierId(Long supplierId) { this.supplierId = supplierId; }

    public Long getBranchId() { return branchId; }
    public void setBranchId(Long branchId) { this.branchId = branchId; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public Long getReceivingUserId() { return receivingUserId; }
    public void setReceivingUserId(Long receivingUserId) { this.receivingUserId = receivingUserId; }

    public LocalDateTime getRequestDate() { return requestDate; }
    public void setRequestDate(LocalDateTime requestDate) { this.requestDate = requestDate; }

    public LocalDateTime getEstimatedArrivalDate() { return estimatedArrivalDate; }
    public void setEstimatedArrivalDate(LocalDateTime estimatedArrivalDate) { this.estimatedArrivalDate = estimatedArrivalDate; }

    public LocalDateTime getActualArrivalDate() { return actualArrivalDate; }
    public void setActualArrivalDate(LocalDateTime actualArrivalDate) { this.actualArrivalDate = actualArrivalDate; }

    public String getReceptionStatus() { return receptionStatus; }
    public void setReceptionStatus(String receptionStatus) { this.receptionStatus = receptionStatus; }

    public String getPaymentStatus() { return paymentStatus; }
    public void setPaymentStatus(String paymentStatus) { this.paymentStatus = paymentStatus; }

    public java.math.BigDecimal getTotal() { return total; }
    public void setTotal(java.math.BigDecimal total) { this.total = total; }

    public LocalDateTime getPaymentDueDate() { return paymentDueDate; }
    public void setPaymentDueDate(LocalDateTime paymentDueDate) { this.paymentDueDate = paymentDueDate; }

    public Integer getPaymentDueDays() { return paymentDueDays; }
    public void setPaymentDueDays(Integer paymentDueDays) { this.paymentDueDays = paymentDueDays; }

    public List<PurchaseDetailEntity> getDetails() { return details; }
    public void setDetails(List<PurchaseDetailEntity> details) { this.details = details; }
}
