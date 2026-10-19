package co.com.zenvory.inventario.sale.application.port.out;

import java.util.List;

/** Valores que se pueden elegir en los filtros de vendedor y producto del historial. */
public record SaleFilterOptions(List<String> sellers, List<String> products) {
}
