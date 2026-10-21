package co.com.zenvory.inventario.transfer.domain.model;

/** Forma en que se pagó (o abonó) el flete de un traslado al transportista. */
public enum TransferPaymentMethod {
    EFECTIVO,
    TRANSFERENCIA,
    CHEQUE,
    TARJETA,
    OTRO
}
