package co.com.zenvory.inventario.branch.domain.model;

import lombok.*;
import java.time.LocalDateTime;

/**
 * Modelo de dominio que representa una Sucursal o sede física de la organización.
 * 
 * <p>Contiene la información de ubicación, contacto y asociación administrativa 
 * (Gerente) de la sede.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Branch {

    /** Identificador único de la sucursal. */
    private Long id;
    
    /** Nombre comercial o descriptivo de la sede. */
    private String name;
    
    /** Dirección física de la sucursal. */
    private String address;
    
    /** Número de teléfono de contacto. */
    private String phone;
    
    /** ID del usuario designado como Gerente de esta sucursal. */
    private Long managerId;

    /** Estado de la sucursal en el sistema (activa/inactiva). */
    @Builder.Default
    private Boolean active = true;

    /** Fecha y hora de creación del registro. */
    private LocalDateTime createdAt;
}