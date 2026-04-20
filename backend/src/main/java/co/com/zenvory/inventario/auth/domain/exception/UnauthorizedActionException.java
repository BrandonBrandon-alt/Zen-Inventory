package co.com.zenvory.inventario.auth.domain.exception;

/**
 * Excepción lanzada cuando un usuario intenta realizar una acción
 * para la cual no tiene permisos a nivel de negocio (ej: anular venta de otra sede).
 */
public class UnauthorizedActionException extends RuntimeException {
    public UnauthorizedActionException(String message) {
        super(message);
    }
}
