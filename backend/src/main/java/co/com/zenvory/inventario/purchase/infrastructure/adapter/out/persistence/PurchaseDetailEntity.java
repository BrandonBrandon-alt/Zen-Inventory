package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;

import java.math.BigDecimal;

/**
 * Entidad JPA que representa el detalle de un ítem en una orden de compra en la base de datos.
 * 
 * <p>Mapea la información técnica y comercial de cada producto solicitado, 
 * así como el seguimiento de las cantidades físicas recibidas tras el despacho 
 * del proveedor.</p>
 */
@Entity
@Table(name = "detalles_orden_compra")
public class PurchaseDetailEntity {

    /** Identificador único autoincremental. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Referencia a la orden de compra contenedora. */
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "orden_id", nullable = false)
    private PurchaseOrderEntity purchaseOrder;

    /** ID del producto solicitado. */
    @Column(name = "producto_id", nullable = false)
    private Long productId;

    /** Cantidad total pactada en la compra. */
    @Column(name = "cantidad", nullable = false, precision = 12, scale = 4)
    private BigDecimal quantity;

    /** Costo unitario acordado con el proveedor. */
    @Column(name = "precio_unitario_pactado", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPrice;

    /** Valor calculado (Cantidad * Precio) - Descuentos. */
    @Column(name = "subtotal", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotal;

    /** Porcentaje de descuento aplicado a esta línea. */
    @Column(name = "descuento_pct", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPct;

    /** Conteo acumulado de unidades recibidas en almacén. */
    @Column(name = "cantidad_recibida", nullable = false, precision = 12, scale = 4)
    private BigDecimal receivedQuantity = BigDecimal.ZERO;

    /** Constructor por defecto requerido por JPA. */
    public PurchaseDetailEntity() {}


    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public PurchaseOrderEntity getPurchaseOrder() { return purchaseOrder; }
    public void setPurchaseOrder(PurchaseOrderEntity purchaseOrder) { this.purchaseOrder = purchaseOrder; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public BigDecimal getQuantity() { return quantity; }
    public void setQuantity(BigDecimal quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPrice() { return unitPrice; }
    public void setUnitPrice(BigDecimal unitPrice) { this.unitPrice = unitPrice; }

    public BigDecimal getSubtotal() { return subtotal; }
    public void setSubtotal(BigDecimal subtotal) { this.subtotal = subtotal; }

    public BigDecimal getDiscountPct() { return discountPct; }
    public void setDiscountPct(BigDecimal discountPct) { this.discountPct = discountPct; }

    public BigDecimal getReceivedQuantity() { return receivedQuantity; }
    public void setReceivedQuantity(BigDecimal receivedQuantity) { this.receivedQuantity = receivedQuantity; }
}
