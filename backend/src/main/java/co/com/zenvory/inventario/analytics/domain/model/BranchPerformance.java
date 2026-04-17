package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

public record BranchPerformance(
        Long branchId,
        String branchName,
        BigDecimal revenue,
        BigDecimal unitsSold,
        long salesCount
) {}
