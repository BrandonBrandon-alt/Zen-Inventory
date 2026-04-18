package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "inventario_local", uniqueConstraints = {
        @UniqueConstraint(columnNames = {"sucursal_id", "producto_id"})
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocalInventoryEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @Column(name = "cantidad_actual", precision = 12, scale = 4)
    private BigDecimal currentQuantity;

    @Column(name = "stock_comprometido", precision = 12, scale = 4)
    private BigDecimal committedQuantity;

    @Column(name = "stock_minimo", precision = 12, scale = 4)
    private BigDecimal minimumStock;

    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    public LocalInventory toDomain() {
        return LocalInventory.builder()
                .id(id)
                .branchId(branchId)
                .productId(productId)
                .currentQuantity(currentQuantity)
                .committedQuantity(committedQuantity)
                .minimumStock(minimumStock)
                .lastUpdated(lastUpdated)
                .build();
    }

    public static LocalInventoryEntity fromDomain(LocalInventory domain) {
        return LocalInventoryEntity.builder()
                .id(domain.getId())
                .branchId(domain.getBranchId())
                .productId(domain.getProductId())
                .currentQuantity(domain.getCurrentQuantity())
                .committedQuantity(domain.getCommittedQuantity())
                .minimumStock(domain.getMinimumStock())
                .lastUpdated(domain.getLastUpdated())
                .build();
    }
}
