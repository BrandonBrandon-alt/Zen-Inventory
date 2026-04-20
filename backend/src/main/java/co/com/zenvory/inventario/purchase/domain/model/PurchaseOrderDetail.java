package co.com.zenvory.inventario.purchase.domain.model;

import java.math.BigDecimal;

/**
 * Modelo de dominio que representa un ítem individual dentro de una orden de compra.
 * 
 * <p>Contiene la información detallada sobre el producto adquirido, las cantidades 
 * pactadas, los precios negociados y el seguimiento de lo efectivamente recibido en bodega.</p>
 */
public class PurchaseOrderDetail {
    /** Identificador único del detalle. */
    private Long id;
    
    /** Identificador del producto relacionado. */
    private Long productId;
    
    /** Cantidad total solicitada al proveedor. */
    private BigDecimal quantity;
    
    /** Precio unitario pactado antes de impuestos o descuentos adicionales. */
    private BigDecimal unitPrice;
    
    /** Porcentaje de descuento aplicado a este ítem específico. */
    private BigDecimal discountPct;
    
    /** Cantidad física que ya ha ingresado al inventario. */
    private BigDecimal receivedQuantity;

    /**
     * Constructor para inicialización completa con validaciones de integridad.
     * 
     * @param id               Identificador único.
     * @param productId        ID del producto.
     * @param quantity         Cantidad a comprar (debe ser > 0).
     * @param unitPrice        Precio unitario (no puede ser negativo).
     * @param discountPct      Porcentaje de descuento (opcional).
     * @param receivedQuantity Cantidad ya recibida (opcional).
     * @throws IllegalArgumentException Si los parámetros numéricos no cumplen las reglas de negocio.
     */
    public PurchaseOrderDetail(Long id, Long productId, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discountPct, BigDecimal receivedQuantity) {
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
        this.receivedQuantity = (receivedQuantity != null) ? receivedQuantity : BigDecimal.ZERO;
    }

    /**
     * Factory method para crear un detalle nuevo sin recepciones previas.
     * 
     * @param productId   ID del producto.
     * @param quantity    Cantidad solicitada.
     * @param unitPrice   Precio pactado.
     * @param discountPct Descuento aplicado.
     * @return Nueva instancia de {@link PurchaseOrderDetail}.
     */
    public static PurchaseOrderDetail create(Long productId, BigDecimal quantity, BigDecimal unitPrice, BigDecimal discountPct) {
        return new PurchaseOrderDetail(null, productId, quantity, unitPrice, discountPct, BigDecimal.ZERO);
    }

    /**
     * Calcula el subtotal monetario del ítem aplicando el descuento correspondiente.
     * 
     * @return {@link BigDecimal} con el valor neto calculado.
     */
    public BigDecimal computeSubtotal() {
        BigDecimal base = this.unitPrice.multiply(this.quantity);
        BigDecimal discountFactor = BigDecimal.ONE.subtract(this.discountPct.divide(new BigDecimal("100")));
        return base.multiply(discountFactor).setScale(2, java.math.RoundingMode.HALF_UP);
    }

    /** @return Identificador único. */
    public Long getId() { return id; }
    
    /** @return ID del producto. */
    public Long getProductId() { return productId; }
    
    /** @return Cantidad solicitada. */
    public BigDecimal getQuantity() { return quantity; }
    
    /** @return Precio unitario pactado. */
    public BigDecimal getUnitPrice() { return unitPrice; }
    
    /** @return Porcentaje de descuento aplicado. */
    public BigDecimal getDiscountPct() { return discountPct; }
    
    /** @return Cantidad física recibida hasta la fecha. */
    public BigDecimal getReceivedQuantity() { return receivedQuantity; }
}

