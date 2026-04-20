package co.com.zenvory.inventario.branch.domain.exception;

/**
 * Excepción de dominio que se lanza cuando no se encuentra una sucursal con el identificador solicitado.
 * 
 * <p>Esta excepción es capturada habitualmente por un GlobalExceptionHandler para retornar 
 * un código de estado 404 Not Found al cliente.</p>
 */
public class BranchNotFoundException extends RuntimeException {

    /** ID de la sucursal que no se pudo localizar. */
    private final Long id;

    /**
     * Constructor de la excepción.
     * @param id Identificador de búsqueda fallida.
     */
    public BranchNotFoundException(Long id) {
        super("Sucursal no encontrada con ID: " + id);
        this.id = id;
    }

    /** @return El ID que originó el error. */
    public Long getId() {
        return id;
    }
}

