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
 * Entidad JPA que representa la tabla {@code producto} en el esquema de base de datos.
 * 
 * <p>Esta clase actúa como el modelo de persistencia para el catálogo maestro de artículos.
 * Incluye lógica de mapeo bidireccional para facilitar la transición entre la capa de 
 * infraestructura y la capa de dominio.</p>
 */
@Entity
@Table(name = "producto")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductEntity {

    /** Identificador único autoincremental en la base de datos. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Código SKU (Stock Keeping Unit) único para identificación logística. */
    @Column(name = "sku", nullable = false, unique = true, length = 50)
    private String sku;

    /** Nombre descriptivo del producto. */
    @Column(name = "nombre", nullable = false, length = 150)
    private String name;

    /** Costo promedio de adquisición ponderado. */
    @Column(name = "costo_promedio", precision = 12, scale = 2)
    private BigDecimal averageCost;

    /** Precio de venta sugerido al público. */
    @Column(name = "precio_venta", precision = 12, scale = 2)
    private BigDecimal salePrice;

    /** Unidad de medida principal para el control de inventario. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "unidad_id", nullable = false)
    private UnitOfMeasureEntity unit;

    /** Marca temporal de creación del registro. */
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    /** Estado de vigencia del producto (Activo/Inactivo). */
    @Column(name = "activa")
    @Builder.Default
    private Boolean active = true;

    /** Colección de proveedores vinculados y sus condiciones comerciales particulares. */
    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ProductSupplierEntity> suppliers = new ArrayList<>();

    // ── Mappers ─────────────────────────────────────────────────────────────

    /** 
     * Convierte esta entidad de persistencia al modelo de dominio {@link Product}.
     * 
     * @return Instancia del dominio con todos los datos enriquecidos.
     */
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
                        .map(ps -> new SupplierSummary(
                            ps.getSupplierId(), 
                            ps.getSupplier() != null ? ps.getSupplier().getName() : "Proveedor #" + ps.getSupplierId(),
                            ps.getNegotiatedPrice(),
                            ps.getPreferred(),
                            ps.getDeliveryDays()
                        ))
                        .collect(Collectors.toList()) : new ArrayList<>())
                .suppliersDetails(this.suppliers != null ?
                    this.suppliers.stream()
                        .map(ps -> co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail.builder()
                            .supplierId(ps.getSupplierId())
                            .negotiatedPrice(ps.getNegotiatedPrice())
                            .deliveryDays(ps.getDeliveryDays())
                            .preferred(ps.getPreferred())
                            .build())
                        .collect(Collectors.toList()) : new ArrayList<>())
                .build();
    }

    /** 
     * Crea una instancia de esta entidad a partir de un objeto de dominio.
     * 
     * @param product Modelo de dominio de origen.
     * @return Entidad JPA preparada para persistencia básica.
     */
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
