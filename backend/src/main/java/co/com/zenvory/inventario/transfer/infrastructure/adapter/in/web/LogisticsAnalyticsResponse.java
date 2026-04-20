package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import java.math.BigDecimal;
import java.util.List;

public record LogisticsAnalyticsResponse(
        GlobalMetrics globalMetrics,
        List<RouteMetrics> topRoutes
) {
    public record GlobalMetrics(
            Long totalTransfers,
            Double onTimePercentage,
            Long delayedTransfers,
            Double averageDelayHours
    ) {}

    public record RouteMetrics(
            Long originBranchId,
            Long destinationBranchId,
            Long totalTransfers,
            Long onTimeTransfers,
            Long delayedTransfers,
            Double averageDelayHours,
            BigDecimal totalShippingCost,
            Long urgentCount
    ) {}
}
