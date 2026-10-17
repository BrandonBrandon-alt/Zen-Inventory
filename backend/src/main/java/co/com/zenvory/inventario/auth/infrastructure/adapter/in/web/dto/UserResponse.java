package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import lombok.Builder;
import java.time.LocalDateTime;

/**
 * Objeto de transferencia (DTO) para la respuesta de datos de usuario.
 * 
 * @param id Identificador único del usuario.
 * @param nombre Nombre completo.
 * @param email Correo electrónico.
 * @param role Perfil de rol asignado.
 * @param sucursalId Sucursal vinculada (null si es global).
 * @param activo Estado de habilitación actual.
 * @param createdAt Fecha y hora de registro inicial.
 * @param avatarActualizadoEn Cuándo cambió la foto de perfil (null si no tiene); sirve de versión para el caché.
 */
@Builder
public record UserResponse(
    Long id,
    String nombre,
    String email,
    RoleResponse role,
    Long sucursalId,
    Boolean activo,
    LocalDateTime createdAt,
    LocalDateTime avatarActualizadoEn
) {

    /** Respuesta a partir del modelo de dominio (sin ningún dato de credenciales). */
    public static UserResponse from(co.com.zenvory.inventario.auth.domain.model.User user) {
        return UserResponse.builder()
                .id(user.getId())
                .nombre(user.getNombre())
                .email(user.getEmail())
                .role(RoleResponse.builder()
                        .id(user.getRole().getId())
                        .nombre(user.getRole().getNombre())
                        .build())
                .sucursalId(user.getSucursalId())
                .activo(user.getActive())
                .createdAt(user.getCreatedAt())
                .avatarActualizadoEn(user.getAvatarUpdatedAt())
                .build();
    }
}
