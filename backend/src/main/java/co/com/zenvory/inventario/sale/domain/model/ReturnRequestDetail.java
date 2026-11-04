package co.com.zenvory.inventario.sale.domain.model;

import java.math.BigDecimal;

/**
 * Detalle individual de un ítem solicitado para devolución.
 */
public class ReturnRequestDetail {
    private Long id;
    /** Línea de la venta que se devuelve: una venta puede repetir el producto con distinto precio. */
    private Long saleDetailId;
    private Long productId;
    private Integer quantity;
    private String reasonSpecific;
    private BigDecimal unitPricePaid;

    public ReturnRequestDetail(Long id, Long saleDetailId, Long productId, Integer quantity, String reasonSpecific, BigDecimal unitPricePaid) {
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("La cantidad a devolver debe ser mayor a cero.");
        }
        this.id = id;
        this.saleDetailId = saleDetailId;
        this.productId = productId;
        this.quantity = quantity;
        this.reasonSpecific = reasonSpecific;
        this.unitPricePaid = unitPricePaid;
    }

    public static ReturnRequestDetail create(Long saleDetailId, Long productId, Integer quantity, String reasonSpecific, BigDecimal unitPricePaid) {
        return new ReturnRequestDetail(null, saleDetailId, productId, quantity, reasonSpecific, unitPricePaid);
    }

    // Getters
    public Long getId() { return id; }
    public Long getSaleDetailId() { return saleDetailId; }
    public Long getProductId() { return productId; }
    public Integer getQuantity() { return quantity; }
    public String getReasonSpecific() { return reasonSpecific; }
    public BigDecimal getUnitPricePaid() { return unitPricePaid; }
}
