package co.com.zenvory.inventario.sale.domain.exception;

/**
 * Excepción lanzada cuando una operación de devolución es inválida por reglas de negocio
 * (ej: cantidad excedida, producto no pertenece a la venta).
 */
public class InvalidReturnOperationException extends RuntimeException {
    public InvalidReturnOperationException(String message) {
        super(message);
    }
}
