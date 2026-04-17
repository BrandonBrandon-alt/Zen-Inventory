package co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto;

import lombok.Builder;

@Builder
public record BranchResponse(Long id, String nombre, String direccion, String telefono, Boolean activa) {
}