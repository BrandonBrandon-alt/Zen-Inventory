package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;
import java.math.BigDecimal;

/**
 * Modelo de dominio que representa la relación entre un Producto
 * y una Unidad de Medida (tabla {@code producto_unidad}).
 *
 * <p>Un producto puede tener múltiples unidades (ej: caja, unidad, docena).
 * Una de ellas es la unidad base ({@code esBase = true}) desde la cual
 * se calculan los factores de conversión de las demás.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductUnit {

    private Long id;

    /** ID del producto al que pertenece esta relación. */
    private Long productId;

    /** ID de la unidad de medida asociada. */
    private Long unitId;

    /**
     * Factor de conversión relativo a la unidad base.
     * Ej: si la unidad base es "unidad", una "caja" con factor 12
     * equivale a 12 unidades.
     */
    private BigDecimal conversionFactor;

    /**
     * Indica si esta es la unidad de medida base del producto.
     * Solo puede haber una unidad base por producto.
     */
    private Boolean isBase;
}
