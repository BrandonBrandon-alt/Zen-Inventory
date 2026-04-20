package co.com.zenvory.inventario.catalog.domain.model;

import lombok.*;

/**
 * Modelo de dominio que representa un Proveedor en el sistema.
 * 
 * <p>Define los datos de contacto y condiciones logísticas base de los 
 * aliados comerciales que abastecen el inventario.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Supplier {

    /** Identificador único del proveedor asignado por el sistema. */
    private Long id;

    /** Nombre comercial o razón social. */
    private String name;

    /** Información detallada de contacto (persona, correo o teléfono). */
    private String contact;

    /** Tiempo estándar de reabastecimiento en días calendario. */
    private Integer deliveryDays;
}

