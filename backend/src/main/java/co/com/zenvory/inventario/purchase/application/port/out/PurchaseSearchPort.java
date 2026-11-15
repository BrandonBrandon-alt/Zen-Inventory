package co.com.zenvory.inventario.purchase.application.port.out;

import co.com.zenvory.inventario.purchase.domain.model.PaymentStatus;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** La lista de compras filtrada, ordenada y paginada en la base, con el saldo y «te toca» de cada orden. */
public interface PurchaseSearchPort {

    Page search(Criteria criteria, PageParams page, String sortBy, boolean ascending);

    /** Los totales del encabezado sobre todo lo que ve quien mira ({@code branchId} nulo = todas las sucursales). */
    Summary summary(Long branchId, Viewer viewer);

    /**
     * @param status {@code "open"} (en curso), {@code "all"} o el nombre de un {@link ReceptionStatus}
     * @param onlyMine solo las que esperan una acción de {@code viewer}
     */
    record Criteria(String status, PaymentStatus payment, LocalDate from, LocalDate to, Long supplierId, Long branchId,
                    Long productId, BigDecimal minTotal, BigDecimal maxTotal, boolean onlyMine, String text, Viewer viewer) {
    }

    record Row(Long id, ReceptionStatus reception, PaymentStatus payment, Long supplierId, String supplierName, Long branchId,
               String branchName, BigDecimal total, BigDecimal balance, boolean overdue, LocalDateTime requestDate, boolean awaitsMe) {
    }

    record Page(List<Row> content, long totalElements) {
    }

    record Summary(long open, long awaitingMe, BigDecimal owed, long owedCount, long overdue) {
    }
}
