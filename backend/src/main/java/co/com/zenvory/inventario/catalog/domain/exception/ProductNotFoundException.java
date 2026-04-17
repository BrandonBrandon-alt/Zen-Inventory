package co.com.zenvory.inventario.catalog.domain.exception;

/**
 * Excepción de dominio lanzada cuando no se encuentra un producto
 * con el ID o SKU solicitado.
 *
 * <p>Vive en el dominio porque representa una violación de una regla
 * de negocio (el producto debe existir). El {@code GlobalExceptionHandler}
 * la traduce a HTTP 404.</p>
 */
public class ProductNotFoundException extends RuntimeException {

    private final Long id;

    public ProductNotFoundException(Long id) {
        super("Producto no encontrado con ID: " + id);
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
