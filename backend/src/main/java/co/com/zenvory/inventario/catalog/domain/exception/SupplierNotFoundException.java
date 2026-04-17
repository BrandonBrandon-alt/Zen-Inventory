package co.com.zenvory.inventario.catalog.domain.exception;

/**
 * Excepción de dominio lanzada cuando no se encuentra un proveedor
 * con el ID solicitado. El {@code GlobalExceptionHandler} la traduce a HTTP 404.
 */
public class SupplierNotFoundException extends RuntimeException {

    private final Long id;

    public SupplierNotFoundException(Long id) {
        super("Proveedor no encontrado con ID: " + id);
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
