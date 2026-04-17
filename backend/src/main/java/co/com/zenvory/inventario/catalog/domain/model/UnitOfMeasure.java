package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;

/**
 * Modelo de dominio que representa una Unidad de Medida (tabla {@code unidad_medida}).
 * Ej: Kilogramo (kg), Litro (L), Unidad (und), Caja (caj).
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitOfMeasure {

    private Long id;

    /** Nombre completo de la unidad. Ej: "Kilogramo". */
    private String name;

    /** Abreviatura estandarizada. Ej: "kg". */
    private String abbreviation;
}
