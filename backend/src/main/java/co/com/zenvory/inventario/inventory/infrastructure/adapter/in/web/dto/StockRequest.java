package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class StockRequest {
    @NotNull(message = "La cantidad es obligatoria")
    @DecimalMin(value = "0.01", message = "La cantidad debe ser mayor a cero")
    private BigDecimal quantity;

    @NotNull(message = "El motivo es obligatorio")
    private MovementReason reason;

    @NotNull(message = "El ID de usuario es obligatorio (autoría)")
    private Long userId;

    private Long referenceId;
    private String referenceType;

    /** Costo unitario de adquisición (opcional, para ingresos) */
    @DecimalMin(value = "0.0", message = "El costo no puede ser negativo")
    private BigDecimal unitCost;
}
