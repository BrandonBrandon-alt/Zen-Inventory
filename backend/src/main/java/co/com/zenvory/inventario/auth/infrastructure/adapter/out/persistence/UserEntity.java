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
/**
 * Entidad JPA que representa la persistencia de un Usuario.
 * 
 * <p>Responsabilidades:
 * <ul>
 *   <li>Mapear la tabla 'usuario' a una clase Java gestionable por Hibernate.</li>
 *   <li>Gestionar la relación con la entidad {@link RoleEntity}.</li>
 *   <li>Mantener el desacoplamiento con el módulo de sucursales almacenando solo el FK numérico.</li>
 * </ul>
 * </p>
 */
@Entity
@Table(name = "usuario")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserEntity {

    /** Identificador primario autoincremental. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre real o alias del usuario. */
    @Column(name = "nombre", nullable = false, length = 100)
    private String nombre;

    /** Correo único para autenticación. */
    @Column(name = "email", nullable = false, unique = true, length = 150)
    private String email;

    /** Hash de contraseña cifrado. */
    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    /**
     * Relación con el rol del usuario.
     * <p>Carga de tipo EAGER ya que el rol siempre es requerido para la autorización.</p>
     */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "rol_id", nullable = false)
    private RoleEntity role;

    /** 
     * Identificador de la sucursal. 
     * <p>Se guarda como FK simple para evitar la dependencia circular con el módulo de Sucursales.</p>
     */
    @Column(name = "sucursal_id")
    private Long sucursalId;

    /** Flag de estado activo. */
    @Builder.Default
    @Column(name = "activa")
    private Boolean activa = true;

    /** Fecha de registro en el sistema. */
    @Column(name = "created_at")
    private LocalDateTime createdAt;

    /**
     * Mapea esta entidad JPA a un objeto de dominio puro.
     * 
     * @return Instancia de {@link User} con los datos de persistencia.
     */
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

    /**
     * Crea una instancia de esta entidad a partir de un objeto de dominio.
     * 
     * @param user Modelo de dominio.
     * @return Entidad lista para persistir.
     */
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

