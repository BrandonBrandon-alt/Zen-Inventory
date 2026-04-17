package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción de dominio lanzada cuando las credenciales proporcionadas
 * son incorrectas. El GlobalExceptionHandler la traduce a HTTP 401.
 */
public class InvalidCredentialsException extends RuntimeException {
    public InvalidCredentialsException() {
        super("Credenciales incorrectas");
    }
}
