package co.com.zenvory.inventario.purchase.domain.model;

import java.math.BigDecimal;

public class PurchaseOrderDetail {
    private Long id;
    private Long productId;
    private BigDecimal quantity;
    private BigDecimal unitPrice;
    private BigDecimal discountPct;

    public PurchaseOrderDetail(Long id, Long productId, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discountPct) {
        if (quantity == null || quantity.compareTo(BigDecimal.ZERO) <= 0) {
            throw new IllegalArgumentException("La cantidad comprada debe ser mayor a cero.");
        }
        if (unitPrice == null || unitPrice.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("El precio unitario no puede ser negativo.");
        }
        this.id = id;
        this.productId = productId;
        this.quantity = quantity;
        this.unitPrice = unitPrice;
        this.discountPct = (discountPct != null) ? discountPct : BigDecimal.ZERO;
    }

    public static PurchaseOrderDetail create(Long productId, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discountPct) {
        return new PurchaseOrderDetail(null, productId, quantity, unitPrice, discountPct);
    }

    public BigDecimal computeSubtotal() {
        BigDecimal base = this.unitPrice.multiply(this.quantity);
        BigDecimal discountFactor = BigDecimal.ONE.subtract(this.discountPct.divide(new BigDecimal("100")));
        return base.multiply(discountFactor).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    public Long getId() { return id; }
    public Long getProductId() { return productId; }
    public BigDecimal getQuantity() { return quantity; }
    public BigDecimal getUnitPrice() { return unitPrice; }
    public BigDecimal getDiscountPct() { return discountPct; }
}
