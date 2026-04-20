package co.com.zenvory.inventario.analytics.application.port.in;

import co.com.zenvory.inventario.analytics.domain.model.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Puerto de entrada (Input Port) que define las operaciones de analítica del sistema.
 */
public interface AnalyticsUseCase {

    /**
     * Obtiene el listado de los productos más vendidos.
     */
    List<TopSellingProduct> getTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Calcula la valoración actual del inventario por sucursal.
     */
    List<BranchValuation> getBranchValuations(Long branchId);

    /**
     * Obtiene un resumen consolidado de las operaciones globales.
     */
    GlobalSummary getGlobalSummary(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Analiza el desempeño comparativo entre sucursales.
     */
    List<BranchPerformance> getBranchPerformance(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Genera la tendencia histórica de ventas agrupada por periodos.
     */
    List<SalesTrend> getSalesTrend(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Consolida toda la información necesaria para el tablero principal (Dashboard).
     */
    DashboardAnalyticsResponse getDashboardData(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Obtiene la comparativa de ventas mensuales de los últimos 6 meses.
     */
    List<MonthlySales> getMonthlySales(Long branchId);

    /**
     * Calcula métricas de rotación de inventario y detección de stock muerto.
     */
    List<InventoryRotation> getInventoryRotation(Long branchId);

    /**
     * Proporciona insights sobre el reabastecimiento proactivo.
     */
    List<ReplenishmentInsight> getReplenishmentInsights(Long branchId);

    /**
     * Analiza el impacto de los traslados activos en el inventario.
     */
    TransferImpact getTransferImpact(Long branchId);
}

