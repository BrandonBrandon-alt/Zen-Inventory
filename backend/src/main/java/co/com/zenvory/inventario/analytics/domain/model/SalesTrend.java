package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Representa un punto de datos en la serie temporal de ventas.
 * 
 * @param saleDate Fecha en la que se registraron las ventas.
 * @param revenue Monto total de ingresos para esa fecha.
 */
public record SalesTrend(
        LocalDate saleDate,
        BigDecimal revenue
) {
}

