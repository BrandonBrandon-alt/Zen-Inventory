package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Entidad JPA que representa la tabla {@code producto_unidad} en la base de datos.
 * 
 * <p>Mapea la relación técnica entre un producto y sus diversas unidades de medida/empaque. 
 * Almacena el factor de conversión numérico necesario para transformar cantidades 
 * entre presentaciones alternativas y la unidad base definida.</p>
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

    /** Identificador único de la asociación técnica. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Referencia (ID) del producto asociado. */
    @Column(name = "producto_id", nullable = false)
    private Long productId;

    /** Referencia (ID) de la unidad de medida involucrada. */
    @Column(name = "unidad_id", nullable = false)
    private Long unitId;

    /** 
     * Coeficiente de conversión de esta unidad a la unidad maestra del producto.
     * Ej: Si la base es gramos y esta es kilogramos, el factor es 1000.
     */
    @Column(name = "factor_conversion", precision = 10, scale = 4)
    @Builder.Default
    private BigDecimal conversionFactor = BigDecimal.ONE;

    /** Indica si esta unidad específica es la referencia base para el inventario. */
    @Column(name = "es_base")
    @Builder.Default
    private Boolean isBase = false;

    /** 
     * Mapea esta entidad de persistencia al modelo de dominio puro {@link ProductUnit}.
     * 
     * @return Instancia del dominio.
     */
    public ProductUnit toDomain() {
        return ProductUnit.builder()
                .id(this.id)
                .productId(this.productId)
                .unitId(this.unitId)
                .conversionFactor(this.conversionFactor)
                .isBase(this.isBase)
                .build();
    }

    /** 
     * Crea una instancia de esta entidad JPA a partir de un objeto de dominio. 
     * 
     * @param productUnit Modelo de dominio de origen.
     * @return Entidad preparada para persistencia.
     */
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

