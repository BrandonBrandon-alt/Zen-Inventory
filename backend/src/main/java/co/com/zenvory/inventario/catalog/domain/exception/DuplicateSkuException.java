package co.com.zenvory.inventario.catalog.domain.exception;

/**
 * Excepción de dominio lanzada cuando se intenta crear un producto
 * con un SKU que ya existe en el sistema.
 * El {@code GlobalExceptionHandler} la traduce a HTTP 409 Conflict.
 */
public class DuplicateSkuException extends RuntimeException {

    private final String sku;

    public DuplicateSkuException(String sku) {
        super("Ya existe un producto con el SKU: " + sku);
        this.sku = sku;
    }

    public String getSku() {
        return sku;
    }
}
