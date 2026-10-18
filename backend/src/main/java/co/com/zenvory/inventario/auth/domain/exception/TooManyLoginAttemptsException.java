package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción de dominio: demasiados intentos de inicio de sesión fallidos. El GlobalExceptionHandler la traduce a HTTP 429.
 */
public class TooManyLoginAttemptsException extends RuntimeException {
    public TooManyLoginAttemptsException() {
        super("Demasiados intentos fallidos. Espera unos minutos antes de intentarlo de nuevo.");
    }
}
