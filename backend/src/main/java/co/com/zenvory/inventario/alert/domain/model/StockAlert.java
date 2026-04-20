package co.com.zenvory.inventario.alert.domain.model;

import co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException;
import java.time.LocalDateTime;

/**
 * Modelo de dominio que representa una alerta de inventario.
 * 
 * <p>Esta clase es el núcleo del módulo de alertas. Captura eventos críticos 
 * (bajo stock, quiebres) y mantiene el estado de su resolución.</p>
 */
public class StockAlert {

    /**
     * Define la naturaleza o el origen del evento que disparó la alerta.
     */
    public enum AlertType {
        /** Stock por debajo del mínimo definido. */
        LOW_STOCK,
        /** Solicitud de traslado enviada entre sucursales. */
        TRANSFER_REQUEST,
        /** Devolución de producto que requiere atención. */
        RETURN_REQUEST,
        /** Sugerencia de compra a proveedor detectada por el motor. */
        PURCHASE_REQUEST,
        /** Problema técnico o de calidad reportado manualmente. */
        ISSUE_REPORTED,
        /** Anulación de venta que podría requerir revisión de inventario. */
        VOID_SALE
    }

    private Long id;
    private Long branchId;
    private Long productId;
    private String message;
    private LocalDateTime alertDate;
    private boolean resolved;
    private ResolutionType resolutionType;
    private AlertType type;
    private Long referenceId;
    private String resolutionReason;
    private LocalDateTime resolvedAt;

    /**
     * Constructor principal con validaciones de negocio.
     * 
     * @param id Identificador único.
     * @param branchId ID de la sucursal afectada.
     * @param productId ID del producto relacionado.
     * @param message Descripción del evento.
     * @param alertDate Fecha de ocurrencia del evento.
     * @param resolved Estado de resolución.
     * @param resolutionType Canal de resolución aplicado.
     * @param type Clasificación de la alerta.
     * @param referenceId ID del documento vinculado (compra, traslado, etc.).
     * @param resolutionReason Explicación del cierre de la alerta.
     * @param resolvedAt Fecha de resolución.
     */
    public StockAlert(Long id, Long branchId, Long productId, String message, LocalDateTime alertDate, boolean resolved,
                      ResolutionType resolutionType, AlertType type, Long referenceId, String resolutionReason, LocalDateTime resolvedAt) {
        if (branchId == null || productId == null) {
            throw new IllegalArgumentException("La sucursal y el producto son obligatorios para una alerta.");
        }
        if (message == null || message.trim().isEmpty()) {
            throw new IllegalArgumentException("El mensaje de la alerta no puede estar vacío.");
        }

        this.id = id;
        this.branchId = branchId;
        this.productId = productId;
        this.message = message;
        this.alertDate = alertDate != null ? alertDate : LocalDateTime.now();
        this.resolved = resolved;
        this.resolutionType = resolutionType;
        this.type = type != null ? type : AlertType.LOW_STOCK;
        this.referenceId = referenceId;
        this.resolutionReason = resolutionReason;
        this.resolvedAt = resolvedAt;
    }

    /**
     * Método de fábrica para crear alertas de bajo stock estándar.
     */
    public static StockAlert create(Long branchId, Long productId, String message) {
        return new StockAlert(null, branchId, productId, message, LocalDateTime.now(), false, null, AlertType.LOW_STOCK, null, null, null);
    }

    /**
     * Método de fábrica para crear alertas tipificadas con referencia.
     */
    public static StockAlert create(Long branchId, Long productId, String message, AlertType type, Long referenceId) {
        return new StockAlert(null, branchId, productId, message, LocalDateTime.now(), false, null, type, referenceId, null, null);
    }

    /**
     * Lógica de dominio para marcar una alerta como resuelta.
     * 
     * @param type El método de resolución (COMPRA, TRASLADO, DESCARTADA).
     * @param refId El identificador del objeto que resuelve la alerta.
     * @param reason Descripción del porqué se cierra la alerta.
     * @throws AlertAlreadyResolvedException Si se intenta resolver una alerta ya cerrada.
     */
    public void resolve(ResolutionType type, Long refId, String reason) {
        if (this.resolved) {
            throw new AlertAlreadyResolvedException("Esta alerta de stock ya se encuentra resuelta.");
        }
        this.resolved = true;
        this.resolutionType = type;
        this.referenceId = refId;
        this.resolutionReason = reason;
        this.resolvedAt = LocalDateTime.now();
    }

    // Getters con propósito de exportación de datos de dominio
    public Long getId() { return id; }
    public Long getBranchId() { return branchId; }
    public Long getProductId() { return productId; }
    public String getMessage() { return message; }
    public LocalDateTime getAlertDate() { return alertDate; }
    public boolean isResolved() { return resolved; }
    public ResolutionType getResolutionType() { return resolutionType; }
    public AlertType getType() { return type; }
    public Long getReferenceId() { return referenceId; }
    public String getResolutionReason() { return resolutionReason; }
    public LocalDateTime getResolvedAt() { return resolvedAt; }
}
