package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.branch.domain.model.Branch;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "sucursal")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BranchEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, length = 100)
    private String name;

    @Column(name = "direccion", length = 255)
    private String address;

    @Column(name = "telefono", length = 50)
    private String phone;

    @Column(name = "activa")
    @Builder.Default
    private Boolean active = true;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    // ── Mappers ─────────────────────────────────────────────────────────────

    /** Convierte la entidad JPA al modelo de dominio puro. */
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

    /** Construye una BranchEntity a partir del modelo de dominio. */
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
