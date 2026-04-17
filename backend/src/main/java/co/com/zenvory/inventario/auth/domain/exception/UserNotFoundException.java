package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción de dominio lanzada cuando no se encuentra un usuario por email.
 * El GlobalExceptionHandler la traduce a HTTP 404.
 */
public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String email) {
        super("Usuario no encontrado con email: " + email);
    }

    public UserNotFoundException(Long id) {
        super("Usuario no encontrado con ID: " + id);
    }
}
