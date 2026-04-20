package co.com.zenvory.inventario.inventory.domain.model;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Modelo de Dominio que representa un registro inmutable en el historial de inventarios (Kardex).
 * 
 * <p>Constituye la prueba de auditoría de cualquier cambio en las existencias físicas.
 * Almacena el qué, quién, cuándo, dónde y por qué de cada afectación de stock, 
 * manteniendo el saldo resultante para verificaciones de integridad.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryMovement {
    
    /** Identificador único del registro de auditoría. */
    private Long id;
    
    /** Naturaleza aritmética del movimiento (Suma/Resta). */
    private MovementType type;
    
    /** Justificación de negocio para el movimiento. */
    private MovementReason reason;
    
    /** Cantidad física afectada en la operación. */
    private BigDecimal quantity;
    
    /** Fecha y hora exacta de la transacción. */
    private LocalDateTime date;
    
    /** Identificador del producto afectado. */
    private Long productId;
    
    /** Identificador de la sucursal o bodega donde ocurre el movimiento. */
    private Long branchId;
    
    /** Identificador del usuario responsable de registrar la acción. */
    private Long userId;
    
    /** ID del documento origen (Venta, Compra, Traslado). */
    private Long referenceId;
    
    /** Tipo de documento de referencia para vinculación lógica. */
    private String referenceType;
    
    /** Notas adicionales o comentarios aclaratorios. */
    private String observations;
    
    /** Detalle específico del motivo (e.g., "Producto vencido"). */
    private String subReason;
    
    /** Saldo neto en existencias inmediatamente después de esta operación. */
    private BigDecimal finalBalance;
}

