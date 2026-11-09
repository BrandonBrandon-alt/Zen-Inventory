package co.com.zenvory.inventario.inventory.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.MovementAuditUseCase;
import co.com.zenvory.inventario.inventory.application.port.out.MovementPage;
import co.com.zenvory.inventario.inventory.application.port.out.MovementRecord;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchPort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/** Acota la página y el tamaño (como el historial de ventas) y limita lo que se exporta. */
@Service
@Transactional(readOnly = true)
public class MovementAuditService implements MovementAuditUseCase {

    static final int MAX_PAGE_SIZE = 100;
    /** Un CSV más grande no se abre bien en una hoja de cálculo; para eso se filtra antes. */
    static final int MAX_EXPORT_ROWS = 20_000;

    private final MovementSearchPort searchPort;

    public MovementAuditService(MovementSearchPort searchPort) {
        this.searchPort = searchPort;
    }

    @Override
    public MovementPage search(MovementSearchCriteria criteria, int page, int size, String sortBy, boolean ascending) {
        return searchPort.search(criteria, Math.max(0, page), Math.min(Math.max(1, size), MAX_PAGE_SIZE), sortBy, ascending);
    }

    @Override
    public List<MovementRecord> export(MovementSearchCriteria criteria, String sortBy, boolean ascending) {
        return searchPort.findAll(criteria, sortBy, ascending, MAX_EXPORT_ROWS);
    }
}
