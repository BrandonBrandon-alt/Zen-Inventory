package co.com.zenvory.inventario.sale.domain.exception;

/**
 * Excepción de dominio: la operación no es válida para el estado actual de la venta (ya anulada, ya devuelta).
 * El GlobalExceptionHandler la traduce a HTTP 409.
 */
public class InvalidSaleStateException extends RuntimeException {
    public InvalidSaleStateException(String message) {
        super(message);
    }
}
