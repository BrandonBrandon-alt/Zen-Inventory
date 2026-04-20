package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.ArrayList;

/**
 * Modelo de dominio que representa un Producto en el catálogo.
 * Es un objeto puro sin dependencias de frameworks ni de persistencia.
 *
 * <p>En arquitectura hexagonal, el dominio es el núcleo de la aplicación.
 * Todo el resto de capas gira alrededor de él.</p>
 */
@Getter
@Setter
@Builder(toBuilder = true)
@NoArgsConstructor
@AllArgsConstructor
public class Product {

    /** Identificador único del producto (asignado por la BD). */
    private Long id;

    /**
     * Código SKU (Stock Keeping Unit) único que identifica el producto
     * comercialmente. Ej: "PROD-001".
     */
    private String sku;

    /** Nombre descriptivo del producto. */
    private String name;

    /** Costo promedio de adquisición del producto (precio de compra). */
    private BigDecimal averageCost;

    /** Precio de venta al público del producto. */
    private BigDecimal salePrice;

    /** ID de la unidad de medida asociada del catálogo maestro. */
    private Long unitId;

    /** Abreviatura de la unidad de medida (para visualización). */
    private String unitAbbreviation;

    /** Fecha en que el producto fue registrado en el sistema. */
    private LocalDateTime createdAt;

    /** IDs de los proveedores asociados (usado principalmente para creación/actualización). */
    @Builder.Default
    private List<Long> supplierIds = new ArrayList<>();

    /** Detalles resumidos de los proveedores asociados (usado para visualización). */
    @Builder.Default
    private List<SupplierSummary> suppliers = new ArrayList<>();

    /** Estado del producto (Activo/Inactivo). */
    @Builder.Default
    private Boolean active = true;
}
