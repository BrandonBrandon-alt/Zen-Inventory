package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.auth.domain.model.User;
import jakarta.persistence.*;
import lombok.*;
import java.time.LocalDateTime;

/**
 * Entidad JPA que mapea la tabla {@code usuario}.
 *
 * <p>La FK a {@code sucursal_id} se guarda como columna simple para no
 * crear una dependencia circular entre módulos. El módulo de auth no
 * conoce a {@code BranchEntity}.</p>
 */
@Entity
@Table(name = "usuario")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    @Column(name = "email", nullable = false, unique = true, length = 150)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    /**
     * Relación ManyToOne con la tabla rol.
     * EAGER porque siempre necesitamos el rol al cargar un usuario (para Spring Security).
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "rol_id", nullable = false)
    private RoleEntity role;

    /** FK simple — evita acoplamiento entre módulos auth y branch. */
    @Column(name = "sucursal_id")
    private Long sucursalId;

    @Builder.Default
    @Column(name = "activa")
    private Boolean activa = true;

    @Column(name = "created_at")
    private LocalDateTime createdAt;

    public User toDomain() {
        return User.builder()
                .id(this.id)
                .nombre(this.nombre)
                .email(this.email)
                .passwordHash(this.passwordHash)
                .role(this.role != null ? this.role.toDomain() : null)
                .sucursalId(this.sucursalId)
                .active(this.activa)
                .createdAt(this.createdAt)
                .build();
    }

    public static UserEntity fromDomain(User user) {
        return UserEntity.builder()
                .id(user.getId())
                .nombre(user.getNombre())
                .email(user.getEmail())
                .passwordHash(user.getPasswordHash())
                .role(user.getRole() != null ? RoleEntity.fromDomain(user.getRole()) : null)
                .sucursalId(user.getSucursalId())
                .activa(user.getActive())
                .createdAt(user.getCreatedAt())
                .build();
    }
}
