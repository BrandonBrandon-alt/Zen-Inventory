package co.com.zenvory.inventario.inventory.application.service;

import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;

@DisplayName("MovementAuditService")
class MovementAuditServiceTest {

    private final MovementSearchPort port = mock(MovementSearchPort.class);
    private final MovementAuditService service = new MovementAuditService(port);
    private final MovementSearchCriteria all = new MovementSearchCriteria(null, null, null, null, null, null, null, null, null, false, null);

    @Test
    @DisplayName("no pide más de 100 filas por página ni páginas negativas")
    void capsPageAndSize() {
        service.search(all, -3, 5000, "date", false);
        verify(port).search(all, 0, MovementAuditService.MAX_PAGE_SIZE, "date", false);
    }

    @Test
    @DisplayName("un tamaño de 0 o negativo pide una fila, no todo")
    void sizeAtLeastOne() {
        service.search(all, 0, 0, "date", false);
        verify(port).search(all, 0, 1, "date", false);
    }

    @Test
    @DisplayName("exportar tiene un límite de filas")
    void exportIsCapped() {
        service.export(all, "date", true);
        verify(port).findAll(any(), any(), any(Boolean.class), org.mockito.ArgumentMatchers.eq(MovementAuditService.MAX_EXPORT_ROWS));
    }
}
