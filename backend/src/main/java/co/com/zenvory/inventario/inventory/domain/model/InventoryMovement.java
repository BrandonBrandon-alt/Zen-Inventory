package co.com.zenvory.inventario.inventory.domain.model;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Modelo de Dominio que representa el historial inmutable (Kardex).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryMovement {
    
    private Long id;
    
    private MovementType type; // INGRESO, RETIRO
    private MovementReason reason; // VENTA, COMPRA, TRASLADO, MERMA, AJUSTE
    
    private BigDecimal quantity;
    private LocalDateTime date;
    
    private Long productId;
    private Long branchId;
    private Long userId; // Persona que ejecutó la acción
    
    private Long referenceId; // ID de la venta, compra o transferencia
    private String referenceType; // Ej: "VENTA", "COMPRA", "TRANSFERENCIA"
    
    private String observations;
    private String subReason;
    private BigDecimal finalBalance; // Saldo después del movimiento
}
