package co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/**
 * Objeto de transferencia (DTO) para la respuesta de datos de una sucursal.
 * 
 * @param id Identificador único de la sucursal.
 * @param nombre Nombre comercial.
 * @param direccion Ubicación física.
 * @param telefono Número de contacto.
 * @param activa Estado de operación actual.
 * @param managerId ID del usuario gerente asignado.
 */
@Builder
public record BranchResponse(Long id, String nombre, String direccion, String telefono, Boolean activa, Long managerId) {

}