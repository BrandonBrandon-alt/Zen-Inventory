package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Proporciona información sobre productos cercanos a agotar su stock.
 * Ayuda en la toma de decisiones proactiva para el reabastecimiento.
 */
public record ReplenishmentInsight(
        Long productId,
        String productName,
        BigDecimal currentStock,
        BigDecimal minStock,
        String priority
) {}
