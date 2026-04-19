package co.com.zenvory.inventario.alert.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.alert.domain.model.ResolutionType;
import jakarta.persistence.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "alertas_stock")
public class AlertEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @Column(name = "mensaje", nullable = false)
    private String message;

    @Column(name = "fecha_alerta", nullable = false)
    private LocalDateTime alertDate;

    @Column(name = "resuelta", nullable = false)
    private Boolean resolved;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_resolucion", length = 50)
    private ResolutionType resolutionType;

    @Column(name = "referencia_id")
    private Long referenceId;

    @Column(name = "motivo_descarte")
    private String resolutionReason;

    @Column(name = "fecha_resolucion")
    private LocalDateTime resolvedAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_alerta", length = 50)
    private co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType type;

    public AlertEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public Long getBranchId() { return branchId; }
    public void setBranchId(Long branchId) { this.branchId = branchId; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public String getMessage() { return message; }
    public void setMessage(String message) { this.message = message; }

    public LocalDateTime getAlertDate() { return alertDate; }
    public void setAlertDate(LocalDateTime alertDate) { this.alertDate = alertDate; }

    public Boolean getResolved() { return resolved; }
    public void setResolved(Boolean resolved) { this.resolved = resolved; }

    public ResolutionType getResolutionType() { return resolutionType; }
    public void setResolutionType(ResolutionType resolutionType) { this.resolutionType = resolutionType; }

    public Long getReferenceId() { return referenceId; }
    public void setReferenceId(Long referenceId) { this.referenceId = referenceId; }

    public String getResolutionReason() { return resolutionReason; }
    public void setResolutionReason(String resolutionReason) { this.resolutionReason = resolutionReason; }

    public LocalDateTime getResolvedAt() { return resolvedAt; }
    public void setResolvedAt(LocalDateTime resolvedAt) { this.resolvedAt = resolvedAt; }

    public co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType getType() { return type; }
    public void setType(co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType type) { this.type = type; }
}
