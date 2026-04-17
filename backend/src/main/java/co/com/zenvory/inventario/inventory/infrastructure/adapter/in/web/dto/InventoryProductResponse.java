package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/**
 * DTO enriquecido que combina información de inventario y catálogo.
 * Diseñado específicamente para alimentar el catálogo de la Terminal POS y el Inventario Principal.
 */
@Builder
public record InventoryProductResponse(
        Long id,
        Long productId,
        String productoNombre,
        String sku,
        java.math.BigDecimal stockActual,
        java.math.BigDecimal stockMinimo,
        java.math.BigDecimal precioVenta,
        java.math.BigDecimal costoPromedio,
        String unit,
        java.time.LocalDateTime lastUpdated
) {}
