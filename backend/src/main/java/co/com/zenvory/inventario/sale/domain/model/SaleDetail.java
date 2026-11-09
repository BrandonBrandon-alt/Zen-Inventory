package co.com.zenvory.inventario.sale.domain.model;

import java.math.BigDecimal;

public class SaleDetail {
    private Long id;
    private Long productId;
    private Integer quantity;
    private BigDecimal unitPriceApplied;
    private BigDecimal discountPercentage;
    private BigDecimal subtotalLine;
    private String productName;
    /** Lista de la que salió el precio; null si se vendió al precio base del producto. */
    private Long priceListId;

    public SaleDetail(Long id, Long productId, String productName, Integer quantity, BigDecimal unitPriceApplied, BigDecimal discountPercentage, Long priceListId) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("La cantidad debe ser mayor a cero.");
        }
        if (unitPriceApplied == null || unitPriceApplied.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalArgumentException("El precio unitario no puede ser negativo.");
        }
        
        this.id = id;
        this.productId = productId;
        this.productName = productName;
        this.priceListId = priceListId;
        this.quantity = quantity;
        this.unitPriceApplied = unitPriceApplied;
        this.discountPercentage = discountPercentage != null ? discountPercentage : BigDecimal.ZERO;
        
        // Calcular subtotal de línea congelado: (cantidad * precio) * (1 - descuento)
        this.subtotalLine = computeSubtotal();
    }

    public static SaleDetail create(Long productId, String productName, Integer quantity, BigDecimal unitPriceApplied, BigDecimal discountPercentage, Long priceListId) {
        return new SaleDetail(null, productId, productName, quantity, unitPriceApplied, discountPercentage, priceListId);
    }

    public BigDecimal computeSubtotal() {
        BigDecimal base = this.unitPriceApplied.multiply(BigDecimal.valueOf(this.quantity));
        BigDecimal discountFactor = BigDecimal.ONE.subtract(this.discountPercentage.divide(BigDecimal.valueOf(100)));
        return base.multiply(discountFactor).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    // Getters
    public Long getId() { return id; }
    public Long getProductId() { return productId; }
    public Integer getQuantity() { return quantity; }
    public BigDecimal getUnitPriceApplied() { return unitPriceApplied; }
    public BigDecimal getDiscountPercentage() { return discountPercentage; }
    public BigDecimal getSubtotalLine() { return subtotalLine; }
    public String getProductName() { return productName; }
    public Long getPriceListId() { return priceListId; }
}
