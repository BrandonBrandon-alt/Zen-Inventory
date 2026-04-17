package co.com.zenvory.inventario.analytics.application.port.out;

import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.BranchValuation;
import co.com.zenvory.inventario.analytics.domain.model.GlobalSummary;
import co.com.zenvory.inventario.analytics.domain.model.TopSellingProduct;
import co.com.zenvory.inventario.analytics.domain.model.SalesTrend;

import java.time.LocalDateTime;
import java.util.List;

public interface AnalyticsRepositoryPort {
    List<TopSellingProduct> findTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate);
    List<BranchValuation> findBranchValuations();
    GlobalSummary findGlobalSummary(LocalDateTime startDate, LocalDateTime endDate);
    List<BranchPerformance> findBranchPerformance(LocalDateTime startDate, LocalDateTime endDate);
    List<SalesTrend> findSalesTrend(LocalDateTime startDate, LocalDateTime endDate);
}
