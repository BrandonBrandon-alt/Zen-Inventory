package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/**
 * DTO (Data Transfer Object) de salida para la representación de proveedores.
 * 
 * <p>Estructura los datos del proveedor para su exposición en la capa API.
 * Garantiza que el cliente reciba la información necesaria para identificar 
 * y contactar a las entidades de suministro.</p>
 *
 * @param id Identificador único del recurso.
 * @param nombre Razón social registrada.
 * @param contacto Información de enlace administrativo.
 * @param tiempoEntregaDias Promedio de días de despacho.
 */
@Builder
public record SupplierResponse(
        Long id,
        String nombre,
        String contacto,
        Integer tiempoEntregaDias
) {}

