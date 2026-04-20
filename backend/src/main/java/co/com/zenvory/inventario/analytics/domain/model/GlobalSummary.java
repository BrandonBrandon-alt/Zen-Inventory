package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Resumen consolidado de métricas globales del sistema.
 * 
 * @param totalRevenue Ingresos totales acumulados.
 * @param totalUnitsSold Cantidad total de unidades vendidas.
 * @param totalInventoryValue Valoración monetaria actual del inventario total.
 * @param averageTicket Promedio de valor por cada transacción de venta.
 * @param branchCount Cantidad de sucursales activas en el sistema.
 */
public record GlobalSummary(
        BigDecimal totalRevenue,
        BigDecimal totalUnitsSold,
        BigDecimal totalInventoryValue,
        BigDecimal averageTicket,
        long branchCount
) {}

