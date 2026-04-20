package co.com.zenvory.inventario.analytics.application.port.in;

import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.BranchValuation;
import co.com.zenvory.inventario.analytics.domain.model.GlobalSummary;
import co.com.zenvory.inventario.analytics.domain.model.TopSellingProduct;
import co.com.zenvory.inventario.analytics.domain.model.SalesTrend;
import co.com.zenvory.inventario.analytics.domain.model.DashboardAnalyticsResponse;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Puerto de entrada (Input Port) que define las operaciones de analítica del sistema.
 * 
 * <p>Proporciona métodos para obtener indicadores clave de rendimiento (KPIs),
 * tendencias de ventas y resúmenes globales para la toma de decisiones.</p>
 */
public interface AnalyticsUseCase {

    /**
     * Obtiene el listado de los productos más vendidos en un rango de fechas.
     * 
     * @param limit Cantidad máxima de productos a retornar (por defecto suele ser 5).
     * @param startDate Fecha inicial del rango de búsqueda (inclusive).
     * @param endDate Fecha final del rango de búsqueda (inclusive).
     * @param branchId ID de la sucursal a filtrar, o null para obtener datos de todas las sucursales.
     * @return Lista de objetos {@link TopSellingProduct} que cumplen el criterio.
     */
    List<TopSellingProduct> getTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Calcula la valoración actual del inventario por sucursal.
     * 
     * @param branchId ID de la sucursal específica, o null para todas.
     * @return Lista de valoraciones por sucursal (costo total y cantidad de productos).
     */
    List<BranchValuation> getBranchValuations(Long branchId);

    /**
     * Obtiene un resumen consolidado de las operaciones globales.
     * 
     * @param startDate Fecha de inicio del periodo.
     * @param endDate Fecha de fin del periodo.
     * @param branchId Filtro opcional por sucursal.
     * @return Objeto {@link GlobalSummary} con totales de ventas, compras y alertas.
     */
    GlobalSummary getGlobalSummary(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Analiza el desempeño comparativo entre sucursales.
     * 
     * @param startDate Fecha de inicio.
     * @param endDate Fecha de fin.
     * @param branchId Filtro opcional.
     * @return Lista de métricas de rendimiento por punto de venta.
     */
    List<BranchPerformance> getBranchPerformance(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Genera la tendencia histórica de ventas agrupada por periodos.
     * 
     * @param startDate Fecha de inicio.
     * @param endDate Fecha de fin.
     * @param branchId Filtro opcional.
     * @return Lista de puntos de tendencia de ventas en el tiempo.
     */
    List<SalesTrend> getSalesTrend(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Consolida toda la información necesaria para el tablero principal (Dashboard).
     * 
     * @param startDate Fecha de inicio para los filtros temporales.
     * @param endDate Fecha de fin para los filtros temporales (opcional).
     * @param branchId Diferenciador de contexto para administradores vs gerentes de sucursal.
     * @return Objeto unificado {@link DashboardAnalyticsResponse} con todos los indicadores.
     */
    DashboardAnalyticsResponse getDashboardData(LocalDateTime startDate, LocalDateTime endDate, Long branchId);
}

