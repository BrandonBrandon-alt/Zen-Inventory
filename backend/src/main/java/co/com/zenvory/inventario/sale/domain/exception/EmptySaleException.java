package co.com.zenvory.inventario.sale.domain.exception;

public class EmptySaleException extends RuntimeException {
    public EmptySaleException(String message) {
        super(message);
    }
}
