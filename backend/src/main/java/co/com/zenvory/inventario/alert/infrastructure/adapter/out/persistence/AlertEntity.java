package co.com.zenvory.inventario.alert.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.alert.domain.model.ResolutionType;
import jakarta.persistence.*;
import java.time.LocalDateTime;

/**
 * Entidad de persistencia (JPA) para las alertas de stock.
 * 
 * <p>Esta clase mapea el modelo de dominio {@code StockAlert} a la tabla 
 * {@code alertas_stock} en la base de datos relacional.</p>
 * 
 * <p>Responsabilidad: Definir la estructura de almacenamiento de las alertas, 
 * incluyendo los detalles de su resolución y tipificación.</p>
 */
@Entity
@Table(name = "alertas_stock")
public class AlertEntity {

    /** Identificador único autoincremental en la base de datos. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID de la sucursal donde se generó la alerta. */
    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    /** ID del producto que disparó la alerta. */
    @Column(name = "producto_id", nullable = false)
    private Long productId;

    /** Descripción textual del problema o evento de stock. */
    @Column(name = "mensaje", nullable = false)
    private String message;

    /** Fecha y hora exacta de registro de la alerta. */
    @Column(name = "fecha_alerta", nullable = false)
    private LocalDateTime alertDate;

    /** Estado lógico de la alerta: true si está gestionada, false si está pendiente. */
    @Column(name = "resuelta", nullable = false)
    private Boolean resolved;

    /** Canal utilizado para resolver la alerta (ENUM: COMPRA, TRASLADO, etc.). */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_resolucion", length = 50)
    private ResolutionType resolutionType;

    /** Identificador del documento de soporte para la resolución (ID de compra o traslado). */
    @Column(name = "referencia_id")
    private Long referenceId;

    /** Justificación o comentarios sobre el cierre de la alerta. */
    @Column(name = "motivo_descarte")
    private String resolutionReason;

    /** Fecha y hora en que se marcó la alerta como resuelta. */
    @Column(name = "fecha_resolucion")
    private LocalDateTime resolvedAt;

    /** Clasificación del evento (bajo stock, quiebre, reporte manual). */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo_alerta", length = 50)
    private co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType type;

    /**
     * Constructor vacío requerido por la especificación JPA.
     */
    public AlertEntity() {}

    // Getters y Setters estándar para permitir la hidratación de datos por Hibernate

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
