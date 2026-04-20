package co.com.zenvory.inventario.inventory.domain.model;

import lombok.Builder;
import lombok.Getter;
import java.math.BigDecimal;

/**
 * Modelo de dominio proyectado que combina el estado del inventario con metadatos del producto.
 * 
 * <p>Diseñado específicamente para capas de visualización, consolidando información 
 * de stock con el nombre, SKU y precios del artículo, evitando múltiples 
 * consultas transversales en la interfaz de usuario.</p>
 */
@Getter
@Builder
public class LocalInventoryEnriched {
    /** Identificador del registro de inventario. */
    private Long id;
    
    /** Identificador del producto. */
    private Long productId;

    /** Nombre descriptivo del producto obtenido del catálogo. */
    private String productNombre;

    /** Código SKU del producto. */
    private String sku;

    /** Existencia física actual. */
    private BigDecimal currentQuantity;

    /** Umbral de alerta de reabastecimiento. */
    private BigDecimal minimumStock;

    /** Precio de comercialización vigente. */
    private BigDecimal salePrice;

    /** Costo promedio ponderado. */
    private BigDecimal averageCost;

    /** Símbolo de la unidad de medida principal. */
    private String unit;

    /** Indica si el producto está habilitado en el catálogo. */
    private Boolean productActive;

    /** Marca temporal del último movimiento o ajuste. */
    private java.time.LocalDateTime lastUpdated;
}

