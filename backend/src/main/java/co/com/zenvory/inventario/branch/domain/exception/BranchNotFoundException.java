package co.com.zenvory.inventario.branch.domain.exception;

/**
 * Excepción de dominio que se lanza cuando no se encuentra
 * una sucursal con el ID solicitado.
 * Vive en el dominio porque representa una regla de negocio
 * (la sucursal debe existir), no un detalle de infraestructura.
 */
public class BranchNotFoundException extends RuntimeException {

    private final Long id;

    public BranchNotFoundException(Long id) {
        super("Sucursal no encontrada con ID: " + id);
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
