package co.com.zenvory.inventario.sale.domain.exception;

/**
 * Excepción lanzada cuando no se encuentra una solicitud de devolución específica.
 */
public class ReturnRequestNotFoundException extends RuntimeException {
    public ReturnRequestNotFoundException(Long id) {
        super("Solicitud de devolución no encontrada. ID: " + id);
    }
}
