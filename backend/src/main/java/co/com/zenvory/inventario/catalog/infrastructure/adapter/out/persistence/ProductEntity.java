package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.SupplierSummary;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Entidad JPA que mapea la tabla {@code producto} de la base de datos.
 *
 * <p>Es un objeto de infraestructura puro: conoce JPA pero el dominio
 * no la conoce. Los métodos {@link #toDomain()} y {@link #fromDomain(Product)}
 * son los únicos puntos de conversión entre las dos representaciones.</p>
 */
@Entity
@Table(name = "producto")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** SKU único del producto, mapeado a la columna {@code sku}. */
    @Column(name = "sku", nullable = false, unique = true, length = 50)
    private String sku;

    @Column(name = "nombre", nullable = false, length = 150)
    private String name;

    @Column(name = "costo_promedio", precision = 12, scale = 2)
    private BigDecimal averageCost;

    @Column(name = "precio_venta", precision = 12, scale = 2)
    private BigDecimal salePrice;


    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unidad_id", nullable = false)
    private UnitOfMeasureEntity unit;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Indica si el producto está disponible para operaciones comerciales. */
    @Column(name = "activa")
    @Builder.Default
    private Boolean active = true;

    /** Relación Muchos a Muchos gestionada a través de la entidad puente. */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductSupplierEntity> suppliers = new ArrayList<>();

    // ── Mappers ─────────────────────────────────────────────────────────────

    /** Convierte la entidad JPA al modelo de dominio puro. */
    public Product toDomain() {
        return Product.builder()
                .id(this.id)
                .sku(this.sku)
                .name(this.name)
                .averageCost(this.averageCost)
                .salePrice(this.salePrice)
                .unitId(this.unit != null ? this.unit.getId() : null)
                .unitAbbreviation(this.unit != null ? this.unit.getAbbreviation() : "UND")
                .createdAt(this.createdAt)
                .active(this.active)
                .suppliers(this.suppliers != null ? 
                    this.suppliers.stream()
                        .map(ps -> new SupplierSummary(ps.getSupplierId(), ps.getSupplier() != null ? ps.getSupplier().getName() : "Proveedor #" + ps.getSupplierId()))
                        .collect(Collectors.toList()) : new ArrayList<>())
                .build();
    }

    /** Construye una {@code ProductEntity} a partir del modelo de dominio. */
    public static ProductEntity fromDomain(Product product) {
        return ProductEntity.builder()
                .id(product.getId())
                .sku(product.getSku())
                .name(product.getName())
                .averageCost(product.getAverageCost())
                .salePrice(product.getSalePrice())
                .unit(product.getUnitId() != null ? UnitOfMeasureEntity.builder().id(product.getUnitId()).build() : null)
                .createdAt(product.getCreatedAt())
                .active(product.getActive() != null ? product.getActive() : true)
                .suppliers(new ArrayList<>())
                .build();
    }
}
