package co.com.zenvory.inventario.sale.application.port.out;

import co.com.zenvory.inventario.sale.domain.model.Sale;

import java.math.BigDecimal;
import java.util.List;

/**
 * Una página del historial más el resumen de <em>todo</em> lo que cumple los filtros (no solo de la página):
 * cuántas ventas completadas hay y cuánto suman.
 */
public record SalePage(List<Sale> content, long totalElements, long completedCount, BigDecimal completedTotal) {
}
