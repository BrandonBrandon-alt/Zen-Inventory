package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import lombok.Builder;

@Builder
public record RoleResponse(
    Long id,
    String nombre
) {}
