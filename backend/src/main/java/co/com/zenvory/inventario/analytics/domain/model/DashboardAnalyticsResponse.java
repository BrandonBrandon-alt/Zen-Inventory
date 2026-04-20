package co.com.zenvory.inventario.analytics.domain.model;

import java.util.List;

/**
 * Objeto de transferencia que consolida todos los indicadores para el tablero de control.
 * 
 * @param summary Resumen de métricas globales (ingresos, valoración, etc.).
 * @param salesTrend Serie temporal de tendencia de ventas diarias.
 * @param topProducts Listado de productos con mayores ventas.
 * @param valuations Valoración del inventario desglosada por sucursal.
 * @param performance Comparativa de rendimiento operativo entre sucursales.
 */
public record DashboardAnalyticsResponse(
        GlobalSummary summary,
        List<SalesTrend> salesTrend,
        List<TopSellingProduct> topProducts,
        List<BranchValuation> valuations,
        List<BranchPerformance> performance
) {}

