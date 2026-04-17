package co.com.zenvory.inventario.catalog.domain.exception;

/**
 * Excepción de dominio lanzada cuando no se encuentra una unidad de medida
 * con el ID solicitado. El {@code GlobalExceptionHandler} la traduce a HTTP 404.
 */
public class UnitOfMeasureNotFoundException extends RuntimeException {

    private final Long id;

    public UnitOfMeasureNotFoundException(Long id) {
        super("Unidad de medida no encontrada con ID: " + id);
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
