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
