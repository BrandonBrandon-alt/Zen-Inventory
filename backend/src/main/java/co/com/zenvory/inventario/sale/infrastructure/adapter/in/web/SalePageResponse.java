package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import java.math.BigDecimal;
import java.util.List;

/** Una página del historial de ventas; el resumen (completadas e importe) abarca todo lo que cumple los filtros. */
public record SalePageResponse(
        List<SaleResponse> content,
        long totalElements,
        int page,
        int size,
        int totalPages,
        long completedCount,
        BigDecimal completedTotal
) {
}
