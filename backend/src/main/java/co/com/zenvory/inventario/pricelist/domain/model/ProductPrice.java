package co.com.zenvory.inventario.pricelist.domain.model;

import java.math.BigDecimal;

/**
 * Modelo de dominio que representa el precio de un producto dentro de una lista específica.
 * 
 * <p>Vincula un artículo del catálogo con un valor monetario dentro de un contexto 
 * de comercialización definido (la {@link PriceList}). Es la unidad mínima de 
 * definición de precios.</p>
 */
public class ProductPrice {
    /** Identificador único del registro de precio. */
    private Long id;
    
    /** ID de la lista de precios a la que pertenece este valor. */
    private Long listaId;
    
    /** ID del producto asociado. */
    private Long productoId;
    
    /** Valor monetario asignado al producto en esta lista. */
    private BigDecimal precio;

    /**
     * Constructor para inicialización completa del precio de producto.
     * 
     * @param id Identificador único.
     * @param listaId Identificador de la lista contenedora.
     * @param productoId Identificador del producto.
     * @param precio Valor del precio.
     */
    public ProductPrice(Long id, Long listaId, Long productoId, BigDecimal precio) {
        this.id = id;
        this.listaId = listaId;
        this.productoId = productoId;
        this.precio = precio;
    }

    /** @return Identificador único. */
    public Long getId() { return id; }
    
    /** @return Identificador de la lista. */
    public Long getListaId() { return listaId; }
    
    /** @return Identificador del producto. */
    public Long getProductoId() { return productoId; }
    
    /** @return Valor del precio actual. */
    public BigDecimal getPrecio() { return precio; }
}

