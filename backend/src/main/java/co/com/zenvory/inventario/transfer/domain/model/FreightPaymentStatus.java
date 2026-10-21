package co.com.zenvory.inventario.transfer.domain.model;

/** Estado de pago del flete de un traslado; se deduce del costo del envío y de los pagos registrados. */
public enum FreightPaymentStatus {
    /** Aún no se despacha, o se despachó sin costo de envío: no hay nada que pagar. */
    SIN_COSTO,
    /** Hay costo de envío y no se ha pagado nada. */
    POR_PAGAR,
    /** Se pagó una parte; queda saldo. */
    PAGO_PARCIAL,
    /** El flete está cubierto por completo. */
    PAGADO
}
