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

@Service
public class AnalyticsService implements AnalyticsUseCase {

    private final AnalyticsRepositoryPort analyticsRepository;

    public AnalyticsService(AnalyticsRepositoryPort analyticsRepository) {
        this.analyticsRepository = analyticsRepository;
    }

    @Override
    public List<TopSellingProduct> getTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate) {
        if (limit <= 0) {
            limit = 5;
        }
        return analyticsRepository.findTopSellingProducts(limit, startDate, endDate);
    }

    @Override
    public List<BranchValuation> getBranchValuations() {
        return analyticsRepository.findBranchValuations();
    }

    @Override
    public GlobalSummary getGlobalSummary(LocalDateTime startDate, LocalDateTime endDate) {
        return analyticsRepository.findGlobalSummary(startDate, endDate);
    }

    @Override
    public List<BranchPerformance> getBranchPerformance(LocalDateTime startDate, LocalDateTime endDate) {
        return analyticsRepository.findBranchPerformance(startDate, endDate);
    }

    @Override
    public List<SalesTrend> getSalesTrend(LocalDateTime startDate, LocalDateTime endDate) {
        return analyticsRepository.findSalesTrend(startDate, endDate);
    }

    @Override
    public DashboardAnalyticsResponse getDashboardData(LocalDateTime startDate, LocalDateTime endDate) {
        return new DashboardAnalyticsResponse(
                getGlobalSummary(startDate, endDate),
                getSalesTrend(startDate, endDate),
                getTopSellingProducts(5, startDate, endDate),
                getBranchValuations(),
                getBranchPerformance(startDate, endDate)
        );
    }
}
