package co.com.zenvory.inventario.inventory.application.port.out;

import java.util.List;

/** Consulta de la auditoría de movimientos: filtrada, ordenada y paginada en la base. */
public interface MovementSearchPort {

    /**
     * @param sortBy campo de orden de la tabla (date, branch, product, type, reason, quantity, balance, responsible,
     *               document); otro valor ordena por fecha.
     */
    MovementPage search(MovementSearchCriteria criteria, int page, int size, String sortBy, boolean ascending);

    /** Todos los que cumplen los filtros, en ese orden, hasta `limit` (para exportar). */
    List<MovementRecord> findAll(MovementSearchCriteria criteria, String sortBy, boolean ascending, int limit);
}
