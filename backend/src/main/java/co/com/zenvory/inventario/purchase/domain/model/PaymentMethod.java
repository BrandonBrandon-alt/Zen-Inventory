package co.com.zenvory.inventario.purchase.domain.model;

/** Forma en que se pagó (o abonó) una orden de compra. */
public enum PaymentMethod {
    EFECTIVO,
    TRANSFERENCIA,
    CHEQUE,
    TARJETA,
    OTRO
}
