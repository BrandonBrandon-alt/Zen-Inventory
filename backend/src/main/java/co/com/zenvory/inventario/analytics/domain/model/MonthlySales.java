package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Representa el volumen de ventas y facturación agrupado por mes.
 * Utilizado para comparativas históricas en el dashboard.
 */
public record MonthlySales(
        String monthName,
        int year,
        BigDecimal revenue,
        BigDecimal volume
) {}
