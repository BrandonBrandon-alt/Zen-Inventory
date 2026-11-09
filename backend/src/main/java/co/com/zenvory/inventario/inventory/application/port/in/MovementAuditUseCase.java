package co.com.zenvory.inventario.inventory.application.port.in;

import co.com.zenvory.inventario.inventory.application.port.out.MovementPage;
import co.com.zenvory.inventario.inventory.application.port.out.MovementRecord;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;

import java.util.List;

/** Auditoría de movimientos de inventario, paginada en el servidor. */
public interface MovementAuditUseCase {

    MovementPage search(MovementSearchCriteria criteria, int page, int size, String sortBy, boolean ascending);

    List<MovementRecord> export(MovementSearchCriteria criteria, String sortBy, boolean ascending);
}
