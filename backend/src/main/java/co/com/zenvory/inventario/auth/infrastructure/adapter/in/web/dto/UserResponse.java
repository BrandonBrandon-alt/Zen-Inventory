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
 */
@Builder
public record UserResponse(
    Long id,
    String nombre,
    String email,
    RoleResponse role,
    Long sucursalId,
    Boolean activo,
    LocalDateTime createdAt
) {}

