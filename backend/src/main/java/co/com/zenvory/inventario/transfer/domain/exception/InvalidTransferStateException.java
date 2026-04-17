package co.com.zenvory.inventario.transfer.domain.exception;

public class InvalidTransferStateException extends RuntimeException {
    public InvalidTransferStateException(String message) {
        super(message);
    }
}
