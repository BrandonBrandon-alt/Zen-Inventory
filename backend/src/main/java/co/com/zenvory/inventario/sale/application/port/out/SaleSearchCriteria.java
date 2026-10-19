package co.com.zenvory.inventario.sale.application.port.out;

import co.com.zenvory.inventario.sale.domain.model.SaleStatus;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Filtros del historial de ventas; todos opcionales. {@code from} y {@code to} incluyen el día completo.
 * {@code supplierId}: ventas con algún producto que ese proveedor surte; {@code withDiscount}: con/sin descuento;
 * {@code registeredCustomer}: con/sin nombre de cliente.
 */
public record SaleSearchCriteria(
        Long branchId,
        SaleStatus status,
        LocalDate from,
        LocalDate to,
        String seller,
        String product,
        BigDecimal minTotal,
        BigDecimal maxTotal,
        String text,
        Long supplierId,
        Boolean withDiscount,
        Boolean registeredCustomer
) {
}
