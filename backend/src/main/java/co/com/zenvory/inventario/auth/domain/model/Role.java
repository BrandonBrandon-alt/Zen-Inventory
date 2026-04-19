package co.com.zenvory.inventario.auth.domain.model;

import lombok.*;

/**
 * Modelo de dominio puro que representa un Rol de usuario.
 * Mapea la tabla {@code rol} de la BD.
 * Los roles posibles son: ADMIN, MANAGER, SELLER, OPERADOR_INVENTARIO.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Role {
    private Long id;
    private String nombre;
}
