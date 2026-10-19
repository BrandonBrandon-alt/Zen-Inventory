package co.com.zenvory.inventario.sale.application.port.out;

import co.com.zenvory.inventario.sale.domain.model.SaleStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Filtros del historial de ventas; todos opcionales. {@code from} y {@code to} incluyen el día completo. */
public record SaleSearchCriteria(
        Long branchId,
        SaleStatus status,
        LocalDate from,
        LocalDate to,
        String seller,
        String product,
        BigDecimal minTotal,
        BigDecimal maxTotal,
        String text
) {
}
