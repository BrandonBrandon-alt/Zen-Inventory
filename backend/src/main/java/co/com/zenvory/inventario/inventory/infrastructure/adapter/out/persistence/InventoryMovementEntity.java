package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entidad JPA que representa la tabla "movimiento_inventario".
 * 
 * <p>Mapea el rastro de auditoría física del stock a la base de datos relacional. 
 * Almacena los registros históricos (Kardex) de cada operación que afecta las 
 * existencias de productos en cualquiera de las sucursales.</p>
 */
@Entity
@Table(name = "movimiento_inventario")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryMovementEntity {

    /** Identificador único autoincremental del movimiento. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Categoría del movimiento (INGRESO/RETIRO). */
    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private MovementType type;

    /** Justificación operativa (VENTA, COMPRA, etc.). */
    @Enumerated(EnumType.STRING)
    @Column(name = "motivo", nullable = false, length = 50)
    private MovementReason reason;

    /** Magnitud de la afectación de stock. */
    @Column(name = "cantidad", nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    /** Fecha y hora de registro de la transacción. */
    @Column(name = "fecha", updatable = false)
    private LocalDateTime date;

    /** ID del producto afectado. */
    @Column(name = "producto_id", nullable = false)
    private Long productId;

    /** ID de la sucursal donde reside el stock. */
    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    /** ID del usuario que realizó la operación. */
    @Column(name = "usuario_id", nullable = false)
    private Long userId;

    /** Identificador del documento fuente (e.g., Factura #123). */
    @Column(name = "referencia_id")
    private Long referenceId;

    /** Etiquetas para identificación del origen (e.g., "VENTA"). */
    @Column(name = "tipo_referencia", length = 50)
    private String referenceType;

    /** Textos libres aclaratorios. */
    @Column(name = "observaciones")
    private String observations;

    /** Detalle refinado de la causa del movimiento. */
    @Column(name = "sub_motivo", length = 100)
    private String subReason;

    /** Cantidad neta resultante tras el movimiento para fines de auditoría. */
    @Column(name = "saldo_final", precision = 12, scale = 2)
    private BigDecimal finalBalance;

    /**
     * Convierte la entidad de persistencia al modelo de dominio.
     * 
     * @return Instancia de {@link InventoryMovement}.
     */
    public InventoryMovement toDomain() {
        return InventoryMovement.builder()
                .id(id)
                .type(type)
                .reason(reason)
                .quantity(quantity)
                .date(date)
                .productId(productId)
                .branchId(branchId)
                .userId(userId)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .observations(observations)
                .subReason(subReason)
                .finalBalance(finalBalance)
                .build();
    }

    /**
     * Crea una instancia de la entidad a partir del modelo de dominio.
     * 
     * @param domain Modelo de dominio del movimiento.
     * @return Entidad JPA mapeada.
     */
    public static InventoryMovementEntity fromDomain(InventoryMovement domain) {
        return InventoryMovementEntity.builder()
                .id(domain.getId())
                .type(domain.getType())
                .reason(domain.getReason())
                .quantity(domain.getQuantity())
                .date(domain.getDate())
                .productId(domain.getProductId())
                .branchId(domain.getBranchId())
                .userId(domain.getUserId())
                .referenceId(domain.getReferenceId())
                .referenceType(domain.getReferenceType())
                .observations(domain.getObservations())
                .subReason(domain.getSubReason())
                .finalBalance(domain.getFinalBalance())
                .build();
    }
}

