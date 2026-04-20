package co.com.zenvory.inventario.analytics.application.port.out;

import co.com.zenvory.inventario.analytics.domain.model.*;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Puerto de salida (Output Port) para la persistencia de datos analíticos.
 * 
 * <p>Define las operaciones de consulta necesarias que deben ser implementadas 
 * por el adaptador de infraestructura (por ejemplo, JPA o una vista de base de datos).</p>
 */
public interface AnalyticsRepositoryPort {

    /**
     * Consulta los productos más vendidos en el repositorio de datos.
     */
    List<TopSellingProduct> findTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Recupera la valoración del stock por sucursal.
     */
    List<BranchValuation> findBranchValuations(Long branchId);

    /**
     * Calcula los totales consolidados de la operación.
     */
    GlobalSummary findGlobalSummary(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Obtiene el listado de desempeño por sucursal.
     */
    List<BranchPerformance> findBranchPerformance(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Recupera la serie temporal de tendencia de ventas.
     */
    List<SalesTrend> findSalesTrend(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Recupera la comparativa de ventas mensuales (últimos 6 meses).
     */
    List<MonthlySales> findMonthlySales(Long branchId);

    /**
     * Calcula la rotación de inventario y detecta productos sin movimiento.
     */
    List<InventoryRotation> findInventoryRotation(Long branchId);

    /**
     * Identifica productos que requieren reabastecimiento proactivo.
     */
    List<ReplenishmentInsight> findReplenishmentInsights(Long branchId);

    /**
     * Calcula el impacto de los traslados activos.
     */
    TransferImpact findTransferImpact(Long branchId);
}

