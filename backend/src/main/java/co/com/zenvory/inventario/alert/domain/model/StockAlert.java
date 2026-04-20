package co.com.zenvory.inventario.alert.domain.model;

import co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException;

import java.time.LocalDateTime;

public class StockAlert {
    public enum AlertType {
        LOW_STOCK,
        TRANSFER_REQUEST,
        RETURN_REQUEST,
        PURCHASE_REQUEST,
        ISSUE_REPORTED,
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

    public static StockAlert create(Long branchId, Long productId, String message) {
        return new StockAlert(null, branchId, productId, message, LocalDateTime.now(), false, null, AlertType.LOW_STOCK, null, null, null);
    }

    public static StockAlert create(Long branchId, Long productId, String message, AlertType type, Long referenceId) {
        return new StockAlert(null, branchId, productId, message, LocalDateTime.now(), false, null, type, referenceId, null, null);
    }

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
