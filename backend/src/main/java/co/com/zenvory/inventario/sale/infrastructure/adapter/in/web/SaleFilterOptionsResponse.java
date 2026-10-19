package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import java.util.List;

/** Vendedores y productos que se pueden elegir en los filtros del historial. */
public record SaleFilterOptionsResponse(List<String> sellers, List<String> products) {
}
