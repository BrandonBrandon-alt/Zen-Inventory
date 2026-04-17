package co.com.zenvory.inventario.pricelist.domain.model;

import java.math.BigDecimal;

/**
 * Modelo de dominio que representa el precio de un producto
 * dentro de una lista de precios específica.
 */
public class ProductPrice {
    private Long id;
    private Long listaId;
    private Long productoId;
    private BigDecimal precio;

    public ProductPrice(Long id, Long listaId, Long productoId, BigDecimal precio) {
        this.id = id;
        this.listaId = listaId;
        this.productoId = productoId;
        this.precio = precio;
    }

    public Long getId() { return id; }
    public Long getListaId() { return listaId; }
    public Long getProductoId() { return productoId; }
    public BigDecimal getPrecio() { return precio; }
}
