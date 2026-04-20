package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Entidad JPA que representa una Orden de Compra en la base de datos.
 * 
 * <p>Almacena la cabecera de la orden, incluyendo fechas clave, estados logísticos 
 * y financieros, y la resolución de auditoría. Gestiona la relación uno-a-muchos 
 * con sus detalles.</p>
 */
@Entity
@Table(name = "ordenes_compra")
public class PurchaseOrderEntity {

    /** Identificador único autoincremental. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID del proveedor destinatario. */
    @Column(name = "proveedor_id", nullable = false)
    private Long supplierId;

    /** ID de la sucursal que realizó el pedido. */
    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    /** ID del usuario que autorizó o creó la orden. */
    @Column(name = "usuario_id", nullable = false)
    private Long userId;

    /** ID del usuario que registró la entrada de mercancía. */
    @Column(name = "usuario_recepcion_id")
    private Long receivingUserId;

    /** Fecha y hora de emisión de la orden. */
    @Column(name = "fecha_solicitud", nullable = false)
    private LocalDateTime requestDate;

    /** Fecha teórica programada para el arribo de la mercancía. */
    @Column(name = "fecha_estimada_llegada")
    private LocalDateTime estimatedArrivalDate;

    /** Fecha efectiva en que se registró el ingreso físico. */
    @Column(name = "fecha_real_llegada")
    private LocalDateTime actualArrivalDate;

    /** Días de espera pactados con el proveedor. */
    @Column(name = "tiempo_entrega_dias")
    private Integer deliveryLeadTimeDays;

    /** Almacena el nombre del estado logístico (ReceptionStatus). */
    @Column(name = "estado_recepcion", nullable = false)
    private String receptionStatus;

    /** Almacena el nombre del estado de pago (PaymentStatus). */
    @Column(name = "estado_pago", nullable = false)
    private String paymentStatus;

    /** Suma total monetaria de la orden. */
    @Column(name = "total", nullable = false)
    private java.math.BigDecimal total;

    /** Fecha límite para cancelar la obligación. */
    @Column(name = "fecha_vencimiento_pago")
    private LocalDateTime paymentDueDate;

    /** Plazo de crédito en días. */
    @Column(name = "plazo_pago_dias", nullable = false)
    private Integer paymentDueDays;

    /** Justificación de aprobaciones excepcionales o cancelaciones. */
    @Column(name = "motivo_resolucion")
    private String reasonResolution;

    /** Usuario responsable de la resolución administrativa. */
    @Column(name = "resuelto_por_id")
    private Long resueltoPorId;

    /** Fecha de la última acción administrativa. */
    @Column(name = "fecha_resolucion")
    private LocalDateTime fechaResolucion;

    /** Indica si se autorizó una compra con anomalías. */
    @Column(name = "excepcion_aprobada", nullable = false)
    private boolean exceptionApproved = false;

    /** Control de concurrencia optimista. */
    @Version
    private Integer version;

    /** Listado detallado de ítems asociados a esta orden. */
    @OneToMany(mappedBy = "purchaseOrder", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<PurchaseDetailEntity> details = new ArrayList<>();

    /** Constructor por defecto requerido por JPA. */
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

    public Integer getDeliveryLeadTimeDays() { return deliveryLeadTimeDays; }
    public void setDeliveryLeadTimeDays(Integer deliveryLeadTimeDays) { this.deliveryLeadTimeDays = deliveryLeadTimeDays; }

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

    public String getReasonResolution() { return reasonResolution; }
    public void setReasonResolution(String reasonResolution) { this.reasonResolution = reasonResolution; }

    public Long getResueltoPorId() { return resueltoPorId; }
    public void setResueltoPorId(Long resueltoPorId) { this.resueltoPorId = resueltoPorId; }

    public LocalDateTime getFechaResolucion() { return fechaResolucion; }
    public void setFechaResolucion(LocalDateTime fechaResolucion) { this.fechaResolucion = fechaResolucion; }

    public boolean isExceptionApproved() { return exceptionApproved; }
    public void setExceptionApproved(boolean exceptionApproved) { this.exceptionApproved = exceptionApproved; }

    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }

    public List<PurchaseDetailEntity> getDetails() { return details; }
    public void setDetails(List<PurchaseDetailEntity> details) { this.details = details; }
}
