package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción de dominio: ya existe otro usuario con ese correo. El GlobalExceptionHandler la traduce a HTTP 409.
 */
public class DuplicateEmailException extends RuntimeException {
    public DuplicateEmailException() {
        super("Ya existe un usuario con ese correo.");
    }
}
