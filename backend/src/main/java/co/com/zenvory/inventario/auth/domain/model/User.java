package co.com.zenvory.inventario.auth.domain.model;

import lombok.*;
import java.time.LocalDateTime;

/**
 * Modelo de dominio puro que representa un Usuario del sistema.
 * Mapea la tabla {@code usuario} de la BD.
 *
 * <p>No contiene lógica de Spring Security — eso pertenece a la
 * capa de infraestructura ({@code UserDetailsAdapter}).</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    private Long id;
    private String nombre;
    private String email;
    private String passwordHash;
    /** ID del rol asignado. Ej: 1=ADMIN, 2=MANAGER, 4=OPERADOR_INVENTARIO. */
    private Role role;
    /** Sucursal asignada (null para ADMIN general). */
    private Long sucursalId;
    private Boolean active;
    private LocalDateTime createdAt;
}
