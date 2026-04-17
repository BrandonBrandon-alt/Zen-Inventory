package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.domain.model.SaleStatus;
import jakarta.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ventas")
public class SaleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "fecha", nullable = false)
    private LocalDateTime date;

    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    @Column(name = "descuento_total", nullable = false, precision = 12, scale = 2)
    private BigDecimal totalDiscount;

    @Column(name = "total_final", nullable = false)
    private BigDecimal totalFinal;

    @Enumerated(EnumType.STRING)
    @Column(name = "estado", nullable = false, length = 20)
    private SaleStatus status = SaleStatus.COMPLETED;

    @Column(name = "motivo_anulacion")
    private String cancellationReason;

    @Column(name = "cliente_nombre", length = 100)
    private String customerName;

    @Column(name = "cliente_documento", length = 20)
    private String customerDocument;

    @Column(name = "global_discount_percentage", precision = 5, scale = 2)
    private BigDecimal globalDiscountPercentage;

    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    @Column(name = "sucursal_nombre")
    private String branchName;

    @Column(name = "usuario_id", nullable = false)
    private Long userId;

    @Column(name = "vendedor_nombre")
    private String userName;

    @OneToMany(mappedBy = "sale", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<SaleDetailEntity> details = new ArrayList<>();

    public SaleEntity() {}

    public void addDetail(SaleDetailEntity detail) {
        details.add(detail);
        detail.setSale(this);
    }

    public void removeDetail(SaleDetailEntity detail) {
        details.remove(detail);
        detail.setSale(null);
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public LocalDateTime getDate() { return date; }
    public void setDate(LocalDateTime date) { this.date = date; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    public BigDecimal getTotalDiscount() { return totalDiscount; }
    public void setTotalDiscount(BigDecimal totalDiscount) { this.totalDiscount = totalDiscount; }

    public BigDecimal getTotalFinal() { return totalFinal; }
    public void setTotalFinal(BigDecimal totalFinal) { this.totalFinal = totalFinal; }

    public Long getBranchId() { return branchId; }
    public void setBranchId(Long branchId) { this.branchId = branchId; }

    public String getBranchName() { return branchName; }
    public void setBranchName(String branchName) { this.branchName = branchName; }

    public Long getUserId() { return userId; }
    public void setUserId(Long userId) { this.userId = userId; }

    public String getUserName() { return userName; }
    public void setUserName(String userName) { this.userName = userName; }

    public List<SaleDetailEntity> getDetails() { return details; }
    public void setDetails(List<SaleDetailEntity> details) { this.details = details; }

    public SaleStatus getStatus() { return status; }
    public void setStatus(SaleStatus status) { this.status = status; }

    public String getCancellationReason() { return cancellationReason; }
    public void setCancellationReason(String cancellationReason) { this.cancellationReason = cancellationReason; }

    public String getCustomerName() { return customerName; }
    public void setCustomerName(String customerName) { this.customerName = customerName; }

    public String getCustomerDocument() { return customerDocument; }
    public void setCustomerDocument(String customerDocument) { this.customerDocument = customerDocument; }

    public BigDecimal getGlobalDiscountPercentage() { return globalDiscountPercentage; }
    public void setGlobalDiscountPercentage(BigDecimal globalDiscountPercentage) { this.globalDiscountPercentage = globalDiscountPercentage; }
}
