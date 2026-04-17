package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.auth.domain.model.Role;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad JPA que mapea la tabla {@code rol}.
 */
@Entity
@Table(name = "rol")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, unique = true, length = 50)
    private String nombre;

    public Role toDomain() {
        return Role.builder()
                .id(this.id)
                .nombre(this.nombre)
                .build();
    }

    public static RoleEntity fromDomain(Role role) {
        return RoleEntity.builder()
                .id(role.getId())
                .nombre(role.getNombre())
                .build();
    }
}
