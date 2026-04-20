package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Entidad JPA que representa la tabla "inventario_local".
 * 
 * <p>Mapea las existencias físicas y lógicas de un producto en una ubicación 
 * específica (Sucursal). Mantiene una restricción de unicidad para la combinación 
 * de sucursal y producto, asegurando un único balance por ubicación.</p>
 */
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

    /** Identificador único autoincremental del registro de inventario. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID de la sucursal o bodega depositaria. */
    @Column(name = "sucursal_id", nullable = false)
    private Long branchId;

    /** ID del producto del catálogo. */
    @Column(name = "producto_id", nullable = false)
    private Long productId;

    /** Cantidad física total disponible en la sucursal. */
    @Column(name = "cantidad_actual", precision = 12, scale = 4)
    private BigDecimal currentQuantity;

    /** Cantidad bloqueada para pedidos en proceso de despacho. */
    @Column(name = "stock_comprometido", precision = 12, scale = 4)
    private BigDecimal committedQuantity;

    /** Nivel mínimo definido para alertas de reabastecimiento. */
    @Column(name = "stock_minimo", precision = 12, scale = 4)
    private BigDecimal minimumStock;

    /** Fecha y hora de la última actualización de saldo o configuración. */
    @Column(name = "last_updated")
    private LocalDateTime lastUpdated;

    /**
     * Convierte la entidad de persistencia al modelo de dominio.
     * 
     * @return Instancia de {@link LocalInventory}.
     */
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

    /**
     * Crea una instancia de la entidad a partir del modelo de dominio.
     * 
     * @param domain Modelo de dominio del inventario local.
     * @return Entidad JPA mapeada.
     */
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

