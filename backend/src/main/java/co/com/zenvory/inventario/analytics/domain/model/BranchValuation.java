package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

public record BranchValuation(
        Long branchId,
        String branchName,
        BigDecimal totalValue
) {}
