package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción de dominio lanzada cuando un usuario intenta iniciar sesión
 * con una cuenta que ha sido desactivada.
 */
public class AccountDisabledException extends RuntimeException {
    public AccountDisabledException() {
        super("La cuenta está desactivada. Por favor, contacte al administrador.");
    }
}
