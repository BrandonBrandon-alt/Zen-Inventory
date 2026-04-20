package co.com.zenvory.inventario.analytics.application.service;

import co.com.zenvory.inventario.analytics.application.port.in.AnalyticsUseCase;
import co.com.zenvory.inventario.analytics.application.port.out.AnalyticsRepositoryPort;
import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.BranchValuation;
import co.com.zenvory.inventario.analytics.domain.model.GlobalSummary;
import co.com.zenvory.inventario.analytics.domain.model.TopSellingProduct;
import co.com.zenvory.inventario.analytics.domain.model.SalesTrend;
import co.com.zenvory.inventario.analytics.domain.model.DashboardAnalyticsResponse;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicación que implementa la lógica de negocio para analítica.
 * 
 * <p>Coordina la recuperación de datos desde el puerto de salida {@link AnalyticsRepositoryPort}
 * y realiza transformaciones básicas o aplicaciones de valores por defecto cuando es necesario.</p>
 */
@Service
public class AnalyticsService implements AnalyticsUseCase {

    private final AnalyticsRepositoryPort analyticsRepository;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param analyticsRepository Puerto de salida para la persistencia de datos analíticos.
     */
    public AnalyticsService(AnalyticsRepositoryPort analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    /**
     * {@inheritDoc}
     * <p>Establece un límite predeterminado de 5 si el valor proporcionado es menor o igual a cero.</p>
     */
    @Override
    public List<TopSellingProduct> getTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate,
            Long branchId) {
        if (limit <= 0) {
            limit = 5;
        }
        return analyticsRepository.findTopSellingProducts(limit, startDate, endDate, branchId);
    }

    @Override
    public List<BranchValuation> getBranchValuations(Long branchId) {
        return analyticsRepository.findBranchValuations(branchId);
    }

    @Override
    public GlobalSummary getGlobalSummary(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        return analyticsRepository.findGlobalSummary(startDate, endDate, branchId);
    }

    @Override
    public List<BranchPerformance> getBranchPerformance(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        return analyticsRepository.findBranchPerformance(startDate, endDate, branchId);
    }

    @Override
    public List<SalesTrend> getSalesTrend(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        return analyticsRepository.findSalesTrend(startDate, endDate, branchId);
    }

    /**
     * {@inheritDoc}
     * <p>Este método orquesta múltiples llamadas para consolidar el estado general del sistema 
     * en una única respuesta estructurada.</p>
     */
    @Override
    public DashboardAnalyticsResponse getDashboardData(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        return new DashboardAnalyticsResponse(
                getGlobalSummary(startDate, endDate, branchId),
                getSalesTrend(startDate, endDate, branchId),
                getTopSellingProducts(5, startDate, endDate, branchId),
                getBranchValuations(branchId),
                getBranchPerformance(startDate, endDate, branchId));
    }
}

