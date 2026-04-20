package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;
import java.math.BigDecimal;

/**
 * Modelo de dominio que representa la asociación entre un Producto y sus Unidades de Medida.
 * 
 * <p>Permite definir múltiples presentaciones de un mismo artículo (e.g., caja, unidad, docena),
 * estableciendo una unidad base y factores de conversión para las presentaciones alternativas.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ProductUnit {

    /** Identificador único de la asociación. */
    private Long id;

    /** ID del producto vinculado. */
    private Long productId;

    /** ID de la unidad de medida correspondiente. */
    private Long unitId;

    /**
     * Coeficiente numérico para transformar esta unidad a la unidad base.
     * Ej: Si la base es 'unidad' y esta es 'caja', un factor de 12 significa 
     * que 1 caja = 12 unidades.
     */
    private BigDecimal conversionFactor;

    /**
     * Determina si esta presentación es la referencia base para el control de inventario.
     * Solo debe existir una unidad base por producto.
     */
    private Boolean isBase;

    /** Nombre de la unidad (enriquecido para visualización). */
    private String unitName;
    
    /** Abreviatura de la unidad (enriquecido para visualización). */
    private String unitAbbreviation;
}

