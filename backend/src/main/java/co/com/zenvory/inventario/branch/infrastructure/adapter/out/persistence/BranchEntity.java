package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.branch.domain.model.Branch;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Entidad JPA que representa la persistencia de una Sucursal.
 * 
 * <p>Mapea la tabla 'sucursal' y encapsula la lógica de conversión 
 * entre la capa de persistencia y el modelo de dominio.</p>
 */
@Entity
@Table(name = "sucursal")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BranchEntity {

    /** Identificador primario autoincremental. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre de la sucursal. */
    @Column(name = "nombre", nullable = false, length = 100)
    private String name;

    /** Dirección de ubicación de la sede. */
    @Column(name = "direccion", length = 255)
    private String address;

    /** Teléfono de contacto de la sede. */
    @Column(name = "telefono", length = 50)
    private String phone;

    /** Estado de operación de la sucursal. */
    @Column(name = "activa")
    @Builder.Default
    private Boolean active = true;

    /** Timestamp de creación (no modificable tras el insert). */
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // ── Mappers ─────────────────────────────────────────────────────────────

    /** 
     * Convierte la entidad JPA al modelo de dominio puro. 
     * 
     * @return Instancia de {@link Branch}.
     */
    public Branch toDomain() {
        return Branch.builder()
                .id(this.id)
                .name(this.name)
                .address(this.address)
                .phone(this.phone)
                .active(this.active)
                .createdAt(this.createdAt)
                .build();
    }

    /** 
     * Construye una BranchEntity a partir del modelo de dominio. 
     * 
     * @param branch Modelo de dominio.
     * @return Entidad persistible.
     */
    public static BranchEntity fromDomain(Branch branch) {
        return BranchEntity.builder()
                .id(branch.getId())
                .name(branch.getName())
                .address(branch.getAddress())
                .phone(branch.getPhone())
                .active(branch.getActive())
                .createdAt(branch.getCreatedAt())
                .build();
    }
}

