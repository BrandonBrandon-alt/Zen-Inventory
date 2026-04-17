package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/** DTO de salida para representar una unidad de medida en la respuesta HTTP. */
@Builder
public record UnitOfMeasureResponse(Long id, String nombre, String abreviatura) {}
