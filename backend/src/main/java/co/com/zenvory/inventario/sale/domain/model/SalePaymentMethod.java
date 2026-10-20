package co.com.zenvory.inventario.sale.domain.model;

/** Cómo pagó el cliente una venta. Alimenta el cierre de caja. */
public enum SalePaymentMethod {
    EFECTIVO,
    TARJETA,
    TRANSFERENCIA,
    OTRO
}
