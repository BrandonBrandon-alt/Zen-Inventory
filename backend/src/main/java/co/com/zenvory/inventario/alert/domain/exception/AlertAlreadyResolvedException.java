package co.com.zenvory.inventario.alert.domain.exception;

public class AlertAlreadyResolvedException extends RuntimeException {
    public AlertAlreadyResolvedException(String message) {
        super(message);
    }
}
