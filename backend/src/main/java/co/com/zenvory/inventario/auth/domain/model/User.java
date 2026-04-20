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
/**
 * Modelo de dominio que representa a un Usuario dentro del ecosistema OptiPlant.
 * 
 * <p>Esta clase encapsula la identidad, credenciales (hash) y permisos del usuario.
 * Es agnóstica de la tecnología de persistencia y de seguridad (Spring Security),
 * centrando su responsabilidad en la representación del perfil del usuario.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {
    /** Identificador único autogenerado. */
    private Long id;
    
    /** Nombre completo o alias de visualización. */
    private String nombre;
    
    /** Correo electrónico único usado para el inicio de sesión. */
    private String email;
    
    /** Hash de la contraseña (BCrypt). Nunca debe almacenarse en texto plano. */
    private String passwordHash;
    
    /** Rol del usuario que define sus permisos a nivel de sistema. */
    private Role role;
    
    /** ID de la sucursal asignada. Los administradores (ADMIN) pueden tener este valor en null. */
    private Long sucursalId;
    
    /** Estado del usuario: true para activo y habilitado, false para deshabilitado. */
    private Boolean active;
    
    /** Timestamp de creación del registro. */
    private LocalDateTime createdAt;
}

