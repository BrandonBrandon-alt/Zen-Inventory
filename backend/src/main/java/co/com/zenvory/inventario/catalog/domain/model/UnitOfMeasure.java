package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;

/**
 * Modelo de dominio que representa una Unidad de Medida en el catálogo.
 * 
 * <p>Define las magnitudes estándar para el control de inventario 
 * (e.g., Kilogramo, Litro, Unidad).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitOfMeasure {

    /** Identificador único de la unidad de medida. */
    private Long id;

    /** Nombre descriptivo completo (e.g., "Kilogramo"). */
    private String name;

    /** Representación abreviada (e.g., "kg"). */
    private String abbreviation;
}

