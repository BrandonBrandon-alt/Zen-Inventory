package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Entidad JPA que representa la relación Muchos a Muchos entre Producto y Proveedor.
 * 
 * <p>Mapea la tabla {@code producto_proveedor}, actuando como una entidad puente que 
 * enriquece la relación con datos comerciales específicos como precios pactados 
 * y tiempos de entrega negociados.</p>
 */
@Entity
@Table(name = "producto_proveedor")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductSupplierEntity {

    /** Identificador único autoincremental de la relación comercial. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Referencia a la entidad del producto (carga perezosa). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "producto_id", insertable = false, updatable = false)
    private ProductEntity product;

    /** Identificador de clave foránea del producto. */
    @Column(name = "producto_id", nullable = false)
    private Long productId;

    /** Referencia a la entidad del proveedor (carga perezosa). */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proveedor_id", insertable = false, updatable = false)
    private SupplierEntity supplier;

    /** Identificador de clave foránea del proveedor. */
    @Column(name = "proveedor_id", nullable = false)
    private Long supplierId;

    /** Código de referencia interno que el proveedor usa para este producto. */
    @Column(name = "sku_proveedor")
    private String supplierSku;

    /** Costo de adquisición negociado con este proveedor para este producto. */
    @Column(name = "precio_pactado", precision = 12, scale = 2)
    private BigDecimal negotiatedPrice;

    /** Tiempo promedio de despacho (lead time) prometido por el proveedor. */
    @Column(name = "tiempo_entrega_dias")
    private Integer deliveryDays;

    /** Marca indicativa si este proveedor es la fuente de abastecimiento prioritaria. */
    @Column(name = "preferido")
    private Boolean preferred;
}

