package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "movimiento_inventario")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class InventoryMovementEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "tipo", nullable = false, length = 20)
    private MovementType type;

    @Enumerated(EnumType.STRING)
    @Column(name = "motivo", nullable = false, length = 50)
    private MovementReason reason;

    @Column(name = "cantidad", nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    @Column(name = "fecha", updatable = false)
    private LocalDateTime date;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    @Column(name = "usuario_id", nullable = false)
    private Long userId;

    @Column(name = "referencia_id")
    private Long referenceId;

    @Column(name = "tipo_referencia", length = 50)
    private String referenceType;

    @Column(name = "observaciones")
    private String observations;

    @Column(name = "sub_motivo", length = 100)
    private String subReason;

    @Column(name = "saldo_final", precision = 12, scale = 2)
    private BigDecimal finalBalance;

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
