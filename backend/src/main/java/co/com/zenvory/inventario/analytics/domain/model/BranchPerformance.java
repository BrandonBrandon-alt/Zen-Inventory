package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Representa el desempeño operativo consolidado de una sucursal.
 * 
 * @param branchId Identificador de la sucursal.
 * @param branchName Nombre descriptivo de la sucursal.
 * @param revenue Ingresos totales generados por ventas.
 * @param unitsSold Cantidad total de unidades de productos vendidas.
 * @param salesCount Cantidad de transacciones de venta realizadas.
 */
public record BranchPerformance(
        Long branchId,
        String branchName,
        BigDecimal revenue,
        BigDecimal unitsSold,
        long salesCount
) {}

