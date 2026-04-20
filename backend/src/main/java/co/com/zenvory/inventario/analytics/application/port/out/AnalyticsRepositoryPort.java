package co.com.zenvory.inventario.analytics.application.port.out;

import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.BranchValuation;
import co.com.zenvory.inventario.analytics.domain.model.GlobalSummary;
import co.com.zenvory.inventario.analytics.domain.model.TopSellingProduct;
import co.com.zenvory.inventario.analytics.domain.model.SalesTrend;

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
     * 
     * @param limit Cantidad de registros.
     * @param startDate Rango inferior.
     * @param endDate Rango superior.
     * @param branchId Filtro de sucursal.
     * @return Lista de productos top.
     */
    List<TopSellingProduct> findTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Recupera la valoración del stock por sucursal.
     * 
     * @param branchId Filtro opcional.
     * @return Lista de valoraciones.
     */
    List<BranchValuation> findBranchValuations(Long branchId);

    /**
     * Calcula los totales consolidados de la operación.
     * 
     * @param startDate Rango inferior.
     * @param endDate Rango superior.
     * @param branchId Filtro opcional.
     * @return Resumen global.
     */
    GlobalSummary findGlobalSummary(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Obtiene el listado de desempeño por sucursal.
     * 
     * @param startDate Rango inferior.
     * @param endDate Rango superior.
     * @param branchId Filtro opcional.
     * @return Desempeño por sucursal.
     */
    List<BranchPerformance> findBranchPerformance(LocalDateTime startDate, LocalDateTime endDate, Long branchId);

    /**
     * Recupera la serie temporal de tendencia de ventas.
     * 
     * @param startDate Rango inferior.
     * @param endDate Rango superior.
     * @param branchId Filtro opcional.
     * @return Serie de ventas.
     */
    List<SalesTrend> findSalesTrend(LocalDateTime startDate, LocalDateTime endDate, Long branchId);
}

