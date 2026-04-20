package co.com.zenvory.inventario.sale.domain.exception;

/**
 * Excepción lanzada cuando no se encuentra una venta específica.
 */
public class SaleNotFoundException extends RuntimeException {
    public SaleNotFoundException(Long id) {
        super("Venta no encontrada con ID: " + id);
    }
}
