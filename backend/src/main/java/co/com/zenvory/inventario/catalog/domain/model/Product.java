package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

/**
 * Modelo de dominio que representa un Producto en el catálogo maestro.
 * 
 * <p>Esta clase es el núcleo de la gestión de mercancías, definiendo su 
 * identidad comercial (SKU), costos, precios de venta y relaciones con 
 * proveedores y unidades de medida.</p>
 */
@Getter
@Setter
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    /** Identificador único del producto asignado por el sistema. */
    private Long id;

    /** 
     * Código SKU (Stock Keeping Unit). 
     * Identificador comercial único para control de inventario.
     */
    private String sku;

    /** Nombre descriptivo o comercial del artículo. */
    private String name;

    /** Valor monetario promedio de adquisición del producto. */
    private BigDecimal averageCost;

    /** Precio sugerido de venta al público. */
    private BigDecimal salePrice;

    /** ID de la unidad de medida principal definida en el catálogo. */
    private Long unitId;

    /** Abreviatura de la unidad de medida (e.g., 'kg', 'und'). */
    private String unitAbbreviation;

    /** Marca temporal del registro inicial del producto. */
    private LocalDateTime createdAt;

    /** 
     * Detalles de configuración comercial con diversos proveedores. 
     * Incluye precios negociados y tiempos de entrega.
     */
    @Builder.Default
    private List<ProductSupplierDetail> suppliersDetails = new ArrayList<>();

    /** 
     * Resumen de proveedores vinculados para propósitos de visualización en interfaz. 
     */
    @Builder.Default
    private List<SupplierSummary> suppliers = new ArrayList<>();

    /** Indica si el producto está habilitado para operaciones comerciales. */
    @Builder.Default
    private Boolean active = true;
}

