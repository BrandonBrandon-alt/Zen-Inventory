package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import co.com.zenvory.inventario.transfer.domain.model.TransferDetail;
import co.com.zenvory.inventario.transfer.domain.model.TransferPayment;
import co.com.zenvory.inventario.transfer.domain.model.TransferPaymentMethod;
import co.com.zenvory.inventario.transfer.domain.model.TransferPriority;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;
import co.com.zenvory.inventario.transfer.domain.service.TransferActionPolicy;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.jdbc.JdbcTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La búsqueda de traslados contra un PostgreSQL real (sucursales 1-3 y productos 1-5 del seed V2). Sin Docker se omite.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(TransferSearchJdbcAdapter.class)
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("TransferSearchJdbcAdapter — traslados paginados en la base")
class TransferSearchJdbcAdapterTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final Viewer ADMIN = new Viewer(true, true, true, null);
    private static final Viewer MANAGER_1 = new Viewer(false, true, true, 1L);
    private static final Viewer MANAGER_2 = new Viewer(false, true, true, 2L);
    private static final Viewer MANAGER_3 = new Viewer(false, true, true, 3L);
    private static final Viewer OPERATOR_1 = new Viewer(false, false, true, 1L);
    private static final Viewer OPERATOR_2 = new Viewer(false, false, true, 2L);
    private static final Viewer SELLER_2 = new Viewer(false, false, false, 2L);
    private static final LocalDateTime DISPATCHED = LocalDateTime.of(2026, 10, 12, 10, 0);

    @Autowired
    private TransferSearchJdbcAdapter adapter;

    @Autowired
    private JdbcTemplate jdbc;

    private long pending;     // 1 → 2, Cemento + Varilla, alta, 10-oct
    private long transit;     // 1 → 3, flete 50.000 con 20.000 pagados (y 15.000 anulados), 11-oct 23:30
    private long delivered;   // 2 → 1, flete 30.000 pagado, 12-oct
    private long noCost;      // 3 → 2, despachado sin costo, 13-oct

    @BeforeEach
    void seed() {
        clean();
        pending = transfer("PENDING", 1, 2, "HIGH", null, null, LocalDateTime.of(2026, 10, 10, 9, 0), 1, 2);
        transit = transfer("IN_TRANSIT", 1, 3, "NORMAL", "50000", DISPATCHED, LocalDateTime.of(2026, 10, 11, 23, 30), 3);
        delivered = transfer("DELIVERED", 2, 1, "LOW", "30000", DISPATCHED, LocalDateTime.of(2026, 10, 12, 8, 0), 1);
        noCost = transfer("IN_TRANSIT", 3, 2, "NORMAL", "0", DISPATCHED, LocalDateTime.of(2026, 10, 13, 8, 0), 4);
        payment(transit, "20000", false);
        payment(transit, "15000", true);
        payment(delivered, "30000", false);
    }

    private void clean() {
        jdbc.update("DELETE FROM pagos_traslado");
        jdbc.update("DELETE FROM detalles_transferencia");
        jdbc.update("UPDATE transferencias SET parent_transfer_id = NULL");
        jdbc.update("DELETE FROM transferencias");
    }

    private static TransferSearchPort.Criteria criteria(String status, Viewer viewer) {
        return new TransferSearchPort.Criteria(status, "all", null, null, null, null, null, null, false, null, viewer);
    }

    private List<Long> ids(TransferSearchPort.Criteria criteria) {
        return adapter.search(criteria, new PageParams(0, 25), "id", false).content().stream().map(TransferSearchPort.Row::id).toList();
    }

    @Test
    @DisplayName("«en curso» deja fuera los entregados; «todos» y un estado puntual también filtran")
    void filtraPorEstado() {
        assertThat(ids(criteria("open", ADMIN))).containsExactly(noCost, transit, pending);
        assertThat(ids(criteria("all", ADMIN))).containsExactly(noCost, delivered, transit, pending);
        assertThat(ids(criteria("DELIVERED", ADMIN))).containsExactly(delivered);
    }

    @Test
    @DisplayName("quien no es ADMIN ve solo los traslados donde su sucursal es origen o destino; la dirección los separa")
    void alcanceYDireccion() {
        assertThat(ids(criteria("all", MANAGER_3))).containsExactly(noCost, transit);
        assertThat(ids(new TransferSearchPort.Criteria("all", "incoming", null, null, null, null, null, null, false, null, MANAGER_2)))
                .containsExactly(noCost, pending);
        assertThat(ids(new TransferSearchPort.Criteria("all", "outgoing", null, null, null, null, null, null, false, null, MANAGER_2)))
                .containsExactly(delivered);
    }

    @Test
    @DisplayName("filtra por prioridad, fechas (día «Hasta» completo), origen, destino y producto")
    void filtraPorCadaCampo() {
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", TransferPriority.HIGH, null, null, null, null, null, false, null, ADMIN))).containsExactly(pending);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11), null, null, null, false, null, ADMIN)))
                .containsExactly(transit, pending);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, 1L, null, null, false, null, ADMIN))).containsExactly(transit, pending);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, null, 2L, null, false, null, ADMIN))).containsExactly(noCost, pending);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, null, null, 2L, false, null, ADMIN))).containsExactly(pending);
    }

    @Test
    @DisplayName("la búsqueda va por número, sucursales y productos, sin tildes")
    void busqueda() {
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, null, null, null, false, "sur", ADMIN))).containsExactly(noCost, transit);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, null, null, null, false, "VARILLA", ADMIN))).containsExactly(pending);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, null, null, null, false, "100%", ADMIN))).isEmpty();
    }

    @Test
    @DisplayName("muestra el primer producto y cuántos son; ordena por la columna pedida y pagina")
    void productosOrdenYPagina() {
        TransferSearchPort.Row first = adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "id", true).content().get(0);
        assertThat(first.id()).isEqualTo(pending);
        assertThat(first.firstProductName()).isEqualTo("Cemento Gris 50Kg");
        assertThat(first.productCount()).isEqualTo(2);
        assertThat(first.originName()).isEqualTo("Sede Central");
        assertThat(first.destinationName()).isEqualTo("Sucursal Norte");

        TransferSearchPort.Page second = adapter.search(criteria("all", ADMIN), new PageParams(1, 3), "priority", true);
        assertThat(second.totalElements()).isEqualTo(4);
        assertThat(second.content()).hasSize(1);
        assertThat(adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "route", true).content())
                .extracting(TransferSearchPort.Row::id).containsExactly(pending, transit, delivered, noCost);
        assertThat(ids(new TransferSearchPort.Criteria("all", "all", null, null, null, null, null, null, false, null, ADMIN)))
                .isEqualTo(adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "id; DROP TABLE transferencias", false).content().stream().map(TransferSearchPort.Row::id).toList());
    }

    @Test
    @DisplayName("el flete coincide con Transfer: los pagos anulados no cuentan y sin costo o sin despacho no se debe nada")
    void fleteCoincideConElDominio() {
        Map<Long, TransferSearchPort.Row> rows = adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "id", true).content().stream()
                .collect(Collectors.toMap(TransferSearchPort.Row::id, Function.identity()));
        for (long id : List.of(pending, transit, delivered, noCost)) {
            Transfer domain = domain(id);
            assertThat(rows.get(id).freightBalance()).as("saldo #%d", id).isEqualByComparingTo(domain.freightBalance());
            assertThat(rows.get(id).freightStatus()).as("estado #%d", id).isEqualTo(domain.freightPaymentStatus());
        }
        assertThat(rows.get(transit).freightBalance()).isEqualByComparingTo("30000");
    }

    @Test
    @DisplayName("«te toca» en SQL coincide con TransferActionPolicy en todos los estados, roles y sucursales (también «solo los míos»)")
    void awaitsMe_SQL_coincide_con_la_politica() {
        clean();
        List<long[]> seeded = new ArrayList<>(); // {id, origen, destino}
        for (TransferStatus status : TransferStatus.values()) {
            for (long[] route : List.of(new long[] {1, 2}, new long[] {2, 3}, new long[] {3, 1})) {
                seeded.add(new long[] {transfer(status.name(), route[0], route[1], "NORMAL", null, null, LocalDateTime.of(2026, 10, 10, 9, 0), 1), route[0], route[1]});
            }
        }
        for (Viewer viewer : List.of(ADMIN, MANAGER_1, MANAGER_2, OPERATOR_1, OPERATOR_2, SELLER_2)) {
            List<TransferSearchPort.Row> rows = adapter.search(criteria("all", viewer), new PageParams(0, 100), "id", true).content();
            assertThat(rows).isNotEmpty();
            for (TransferSearchPort.Row row : rows) {
                assertThat(row.awaitsMe()).as("%s %d→%d con %s", row.status(), row.originId(), row.destinationId(), viewer)
                        .isEqualTo(TransferActionPolicy.awaits(row.status(), row.originId(), row.destinationId(), viewer));
            }
            List<Long> mine = adapter.search(new TransferSearchPort.Criteria("all", "all", null, null, null, null, null, null, true, null, viewer),
                    new PageParams(0, 100), "id", true).content().stream().map(TransferSearchPort.Row::id).toList();
            assertThat(mine).as("solo los míos con %s", viewer).containsExactlyInAnyOrderElementsOf(rows.stream()
                    .filter(r -> TransferActionPolicy.awaits(r.status(), r.originId(), r.destinationId(), viewer)).map(TransferSearchPort.Row::id).toList());
        }
    }

    @Test
    @DisplayName("el resumen cuenta todo lo visible, sin importar la página")
    void summary() {
        TransferSearchPort.Summary all = adapter.summary(ADMIN);
        assertThat(all.open()).isEqualTo(3);
        assertThat(all.awaitingMe()).isEqualTo(3); // aprobar #pending, recibir #transit y #noCost
        assertThat(all.freightOwed()).isEqualByComparingTo("30000");
        assertThat(all.freightOwedCount()).isEqualTo(1);

        TransferSearchPort.Summary norte = adapter.summary(MANAGER_2);
        assertThat(norte.open()).isEqualTo(2);       // pending (destino) y noCost (destino)
        assertThat(norte.awaitingMe()).isEqualTo(2); // aprobar pending, recibir noCost
        assertThat(norte.freightOwed()).isEqualByComparingTo("0");
    }

    private Transfer domain(long id) {
        Map<String, Object> t = jdbc.queryForMap("SELECT * FROM transferencias WHERE id = ?", id);
        List<TransferPayment> payments = jdbc.query("SELECT * FROM pagos_traslado WHERE traslado_id = ?", (rs, i) -> new TransferPayment(
                rs.getLong("id"), rs.getBigDecimal("monto"), rs.getTimestamp("fecha").toLocalDateTime(), rs.getLong("usuario_id"), rs.getString("usuario_nombre"),
                TransferPaymentMethod.valueOf(rs.getString("metodo")), null, null,
                rs.getTimestamp("anulado_en") == null ? null : rs.getTimestamp("anulado_en").toLocalDateTime(),
                (Long) rs.getObject("anulado_por_id", Long.class), rs.getString("anulado_por_nombre"), rs.getString("motivo_anulacion")), id);
        java.sql.Timestamp dispatch = (java.sql.Timestamp) t.get("fecha_despacho");
        return new Transfer(id, TransferStatus.valueOf((String) t.get("estado")), ((java.sql.Timestamp) t.get("fecha_solicitud")).toLocalDateTime(), null, null,
                ((Number) t.get("sucursal_origen_id")).longValue(), ((Number) t.get("sucursal_destino_id")).longValue(), null, null,
                List.of(new TransferDetail(null, 1L, "x", 1, 0, 0, 0)), null, TransferPriority.NORMAL, (BigDecimal) t.get("costo_envio"), null,
                null, null, dispatch == null ? null : dispatch.toLocalDateTime(), 0, null, null, null, null, null, null, null, null, null, null, payments);
    }

    private long transfer(String status, long origin, long destination, String priority, String cost, LocalDateTime dispatched, LocalDateTime requested, long... products) {
        long id = jdbc.queryForObject("""
                INSERT INTO transferencias (estado, fecha_solicitud, sucursal_origen_id, sucursal_destino_id, prioridad, costo_envio, fecha_despacho)
                VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id
                """, Long.class, status, requested, origin, destination, priority, cost == null ? null : new BigDecimal(cost), dispatched);
        for (long product : products) {
            jdbc.update("INSERT INTO detalles_transferencia (transferencia_id, producto_id, cantidad_solicitada) VALUES (?, ?, 5)", id, product);
        }
        return id;
    }

    private void payment(long transfer, String amount, boolean voided) {
        jdbc.update("""
                INSERT INTO pagos_traslado (traslado_id, monto, usuario_id, usuario_nombre, metodo, anulado_en, anulado_por_id, motivo_anulacion)
                VALUES (?, ?, 1, 'Admin', 'EFECTIVO', ?, ?, ?)
                """, transfer, new BigDecimal(amount), voided ? LocalDateTime.of(2026, 10, 20, 9, 0) : null, voided ? 1L : null, voided ? "error" : null);
    }
}
