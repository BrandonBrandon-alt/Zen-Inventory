package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Resume el impacto de los traslados activos en el inventario.
 * Cuantifica el volumen y valor de los activos en tránsito.
 */
public record TransferImpact(
        int activeTransfersCount,
        BigDecimal totalItemsInTransit,
        BigDecimal totalValuationInTransit
) {}
