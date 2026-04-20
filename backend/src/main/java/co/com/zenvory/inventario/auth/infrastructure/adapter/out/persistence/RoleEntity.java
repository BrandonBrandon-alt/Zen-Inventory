package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.auth.domain.model.Role;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad JPA que mapea la tabla {@code rol}.
 */
/**
 * Entidad JPA que representa la persistencia de un Rol.
 * 
 * <p>Mapea la tabla 'rol' y provee los métodos de conversión hacia el modelo de dominio.</p>
 */
@Entity
@Table(name = "rol")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RoleEntity {

    /** Identificador primario del rol. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre único del perfil de acceso. */
    @Column(name = "nombre", nullable = false, unique = true, length = 50)
    private String nombre;

    /**
     * Convierte la entidad a un objeto de dominio puro.
     * 
     * @return Instancia de {@link Role}.
     */
    public Role toDomain() {
        return Role.builder()
                .id(this.id)
                .nombre(this.nombre)
                .build();
    }

    /**
     * Crea una entidad JPA a partir de un objeto de dominio.
     * 
     * @param role Modelo de dominio.
     * @return Entidad persistible.
     */
    public static RoleEntity fromDomain(Role role) {
        return RoleEntity.builder()
                .id(role.getId())
                .nombre(role.getNombre())
                .build();
    }
}

