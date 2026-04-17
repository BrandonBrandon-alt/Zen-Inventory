package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/** DTO de salida para representar un proveedor en la respuesta HTTP. */
@Builder
public record SupplierResponse(
        Long id,
        String nombre,
        String contacto,
        Integer tiempoEntregaDias
) {}
