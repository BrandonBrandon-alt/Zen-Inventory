package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción de dominio lanzada cuando no existe el rol indicado.
 * El GlobalExceptionHandler la traduce a HTTP 404.
 */
public class RoleNotFoundException extends RuntimeException {
    public RoleNotFoundException(Long id) {
        super("Rol no encontrado con ID: " + id);
    }
}
