package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;

/**
 * Modelo de dominio que representa un Proveedor.
 * Objeto puro sin dependencias de frameworks.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Supplier {

    /** Identificador único del proveedor. */
    private Long id;

    /** Nombre comercial del proveedor. */
    private String name;

    /** Nombre o email del contacto principal. */
    private String contact;

    /** Días promedio que tarda el proveedor en entregar mercancía. */
    private Integer deliveryDays;
}
