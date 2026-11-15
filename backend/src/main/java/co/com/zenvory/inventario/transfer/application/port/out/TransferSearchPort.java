package co.com.zenvory.inventario.transfer.application.port.out;

import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus;
import co.com.zenvory.inventario.transfer.domain.model.TransferPriority;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * La lista de traslados filtrada, ordenada y paginada en la base, con el flete y «te toca» de cada uno. Quien no es
 * ADMIN solo ve los traslados donde su sucursal ({@link Viewer#branchId()}) es origen o destino.
 */
public interface TransferSearchPort {

    Page search(Criteria criteria, PageParams page, String sortBy, boolean ascending);

    /** Los totales del encabezado sobre todo lo que ve {@code viewer}. */
    Summary summary(Viewer viewer);

    /**
     * @param status    {@code "open"} (en curso), {@code "all"} o el nombre de un {@link TransferStatus}
     * @param direction {@code "all"}, {@code "incoming"} (llegan a la sucursal de quien mira) u {@code "outgoing"} (salen de ella)
     * @param onlyMine  solo los que esperan una acción de {@code viewer}
     */
    record Criteria(String status, String direction, TransferPriority priority, LocalDate from, LocalDate to, Long originId,
                    Long destinationId, Long productId, boolean onlyMine, String text, Viewer viewer) {
    }

    record Row(Long id, TransferStatus status, TransferPriority priority, Long originId, String originName, Long destinationId,
               String destinationName, String firstProductName, int productCount, FreightPaymentStatus freightStatus,
               BigDecimal freightBalance, LocalDateTime requestDate, boolean awaitsMe) {
    }

    record Page(List<Row> content, long totalElements) {
    }

    record Summary(long open, long awaitingMe, BigDecimal freightOwed, long freightOwedCount) {
    }
}
