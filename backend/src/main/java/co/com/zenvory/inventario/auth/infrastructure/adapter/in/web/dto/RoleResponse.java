package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/**
 * Objeto de transferencia (DTO) para representar la información básica de un rol.
 * 
 * @param id Identificador único del rol.
 * @param nombre Nombre descriptivo del rol (ej: "ADMIN").
 */
@Builder
public record RoleResponse(
    Long id,
    String nombre
) {}

