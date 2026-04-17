package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import jakarta.persistence.*;

import java.math.BigDecimal;

@Entity
@Table(name = "detalles_venta")
public class SaleDetailEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "venta_id", nullable = false)
    private SaleEntity sale;

    @Column(name = "producto_id", nullable = false)
    private Long productId;

    @Column(name = "producto_nombre")
    private String productName;

    @Column(name = "cantidad", nullable = false)
    private Integer quantity;

    @Column(name = "precio_unitario_aplicado", nullable = false, precision = 12, scale = 2)
    private BigDecimal unitPriceApplied;

    @Column(name = "porcentaje_descuento", nullable = false, precision = 5, scale = 2)
    private BigDecimal discountPercentage;

    @Column(name = "subtotal_linea", nullable = false, precision = 12, scale = 2)
    private BigDecimal subtotalLine;

    public SaleDetailEntity() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    
    public SaleEntity getSale() { return sale; }
    public void setSale(SaleEntity sale) { this.sale = sale; }

    public Long getProductId() { return productId; }
    public void setProductId(Long productId) { this.productId = productId; }

    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }

    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }

    public BigDecimal getUnitPriceApplied() { return unitPriceApplied; }
    public void setUnitPriceApplied(BigDecimal unitPriceApplied) { this.unitPriceApplied = unitPriceApplied; }

    public BigDecimal getDiscountPercentage() { return discountPercentage; }
    public void setDiscountPercentage(BigDecimal discountPercentage) { this.discountPercentage = discountPercentage; }

    public BigDecimal getSubtotalLine() { return subtotalLine; }
    public void setSubtotalLine(BigDecimal subtotalLine) { this.subtotalLine = subtotalLine; }
}
