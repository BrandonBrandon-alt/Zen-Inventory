package co.com.zenvory.inventario.analytics.domain.model;

import java.util.List;

public record DashboardAnalyticsResponse(
        GlobalSummary summary,
        List<SalesTrend> salesTrend,
        List<TopSellingProduct> topProducts,
        List<BranchValuation> valuations,
        List<BranchPerformance> performance
) {}
