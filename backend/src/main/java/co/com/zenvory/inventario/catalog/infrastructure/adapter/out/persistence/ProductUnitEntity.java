package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Entidad JPA que mapea la tabla {@code producto_unidad}.
 * Representa la relación entre un producto y sus unidades de medida,
 * incluyendo el factor de conversión respecto a la unidad base.
 */
@Entity
@Table(
    name = "producto_unidad",
    uniqueConstraints = @UniqueConstraint(columnNames = {"producto_id", "unidad_id"})
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductUnitEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @Column(name = "unidad_id", nullable = false)
    private Long unitId;

    @Column(name = "factor_conversion", precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal conversionFactor = BigDecimal.ONE;

    @Column(name = "es_base")
    @Builder.Default
    private Boolean isBase = false;

    public ProductUnit toDomain() {
        return ProductUnit.builder()
                .id(this.id)
                .productId(this.productId)
                .unitId(this.unitId)
                .conversionFactor(this.conversionFactor)
                .isBase(this.isBase)
                .build();
    }

    public static ProductUnitEntity fromDomain(ProductUnit productUnit) {
        return ProductUnitEntity.builder()
                .id(productUnit.getId())
                .productId(productUnit.getProductId())
                .unitId(productUnit.getUnitId())
                .conversionFactor(productUnit.getConversionFactor())
                .isBase(productUnit.getIsBase())
                .build();
    }
}
