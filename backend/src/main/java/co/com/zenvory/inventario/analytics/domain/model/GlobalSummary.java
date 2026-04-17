package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

public record GlobalSummary(
        BigDecimal totalRevenue,
        BigDecimal totalUnitsSold,
        BigDecimal totalInventoryValue,
        BigDecimal averageTicket,
        long branchCount
) {}
