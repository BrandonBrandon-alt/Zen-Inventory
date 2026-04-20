package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

/**
 * DTO (Data Transfer Object) de entrada para el registro de ajustes manuales de stock.
 * 
 * <p>Encapsula la información necesaria para realizar ingresos o retiros directos 
 * de mercancía, incluyendo metadatos de auditoría y parámetros técnicos como el 
 * costo de adquisición o la identificación de unidades.</p>
 */
@Data
public class StockRequest {
    /** Cantidad física a afectar en el inventario. */
    @NotNull(message = "La cantidad es obligatoria")
    @DecimalMin(value = "0.01", message = "La cantidad debe ser mayor a cero")
    private BigDecimal quantity;

    /** Justificación del movimiento (e.g., MERMA, AJUSTE_POSITIVO). */
    @NotNull(message = "El motivo es obligatorio")
    private MovementReason reason;

    /** Identificador del usuario que reporta la novedad. */
    @NotNull(message = "El ID de usuario es obligatorio (autoría)")
    private Long userId;

    /** ID del documento o entidad externa relacionada. */
    private Long referenceId;

    /** Nombre del tipo de documento de referencia. */
    private String referenceType;

    /** Costo unitario de adquisición (opcional, para ingresos de mercancía). */
    @DecimalMin(value = "0.0", message = "El costo no puede ser negativo")
    private BigDecimal unitCost;

    /** Comentarios adicionales. */
    private String observations;

    /** Detalle específico del motivo. */
    private String subReason;

    /** ID de la unidad de medida en la que se expresa la cantidad. */
    private Long unitId;
}

