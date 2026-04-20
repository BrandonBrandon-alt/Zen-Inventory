package co.com.zenvory.inventario.auth.domain.model;

import lombok.*;

/**
 * Modelo de dominio puro que representa un Rol de usuario.
 * Mapea la tabla {@code rol} de la BD.
 * Los roles posibles son: ADMIN, MANAGER, SELLER, OPERADOR_INVENTARIO.
 */
/**
 * Modelo de dominio que representa un Rol o perfil de acceso en el sistema.
 * 
 * <p>Los roles definen el conjunto de acciones permitidas para un usuario.
 * Los perfiles estándar incluyen:
 * <ul>
 *   <li>ADMIN: Control total del sistema y gestión de usuarios.</li>
 *   <li>MANAGER: Gestión operativa de sucursal y reportes.</li>
 *   <li>OPERADOR_INVENTARIO: Movimientos de stock, ventas y compras.</li>
 * </ul></p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Role {
    /** Identificador único del rol. */
    private Long id;
    
    /** Nombre del rol (ej: "ADMIN", "MANAGER"). */
    private String nombre;
}

