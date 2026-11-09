package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import java.math.BigDecimal;

/**
 * Existencia disponible de un producto en una sucursal (lo que hay menos lo comprometido en traslados pendientes).
 * No incluye precios ni costos: es lo único que una sucursal que pide mercancía necesita saber de la que la envía.
 */
public record BranchAvailabilityResponse(Long productId, BigDecimal available) {
}
