package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Representa la valoración económica del inventario en una sucursal específica.
 * 
 * @param branchId ID de la sucursal.
 * @param branchName Nombre de la sucursal.
 * @param totalValue Valor total de la mercancía (cantidad * costo promedio).
 */
public record BranchValuation(
        Long branchId,
        String branchName,
        BigDecimal totalValue
) {}

