package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;
import lombok.*;
import java.math.BigDecimal;

/**
 * Entidad que representa la relación Muchos a Muchos entre Producto y Proveedor.
 * Almacena el catálogo de proveedores para un producto específico.
 */
@Entity
@Table(name = "producto_proveedor")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductSupplierEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "producto_id", insertable = false, updatable = false)
    private ProductEntity product;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "proveedor_id", insertable = false, updatable = false)
    private SupplierEntity supplier;

    @Column(name = "proveedor_id", nullable = false)
    private Long supplierId;

    @Column(name = "sku_proveedor")
    private String supplierSku;

    @Column(name = "precio_pactado", precision = 12, scale = 2)
    private BigDecimal negotiatedPrice;

    @Column(name = "tiempo_entrega_dias")
    private Integer deliveryDays;

    @Column(name = "preferido")
    private Boolean preferred;
}
