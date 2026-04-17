package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web.dto;

import lombok.Builder;
import java.time.LocalDateTime;

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
