package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Representa la métrica de rotación de un producto.
 * Permite identificar productos de alta demanda e inventario estancado.
 */
public record InventoryRotation(
        Long productId,
        String productName,
        BigDecimal soldQuantity,
        BigDecimal currentStock,
        BigDecimal rotationRatio,
        boolean isDeadStock,
        Integer inactiveDays
) {}

