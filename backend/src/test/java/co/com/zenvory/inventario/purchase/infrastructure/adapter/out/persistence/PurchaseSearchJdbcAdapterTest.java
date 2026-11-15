package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort;
import co.com.zenvory.inventario.purchase.domain.model.PaymentStatus;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrderDetail;
import co.com.zenvory.inventario.purchase.domain.model.PurchasePayment;
import co.com.zenvory.inventario.purchase.domain.model.PaymentMethod;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.purchase.domain.service.PurchaseActionPolicy;
import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
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
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La búsqueda de compras contra un PostgreSQL real (proveedores 1-3, sucursales 1-3 y productos 1-5 del seed V2).
 * Sin Docker la clase se omite.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(PurchaseSearchJdbcAdapter.class)
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("PurchaseSearchJdbcAdapter — compras paginadas en la base")
class PurchaseSearchJdbcAdapterTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static final Viewer ADMIN = new Viewer(true, true, true, null);
    private static final Viewer MANAGER = new Viewer(false, true, true, 1L);
    private static final Viewer OPERADOR = new Viewer(false, false, true, 1L);
    private static final Viewer SELLER = new Viewer(false, false, false, 1L);
    private static final LocalDateTime PAST = LocalDateTime.of(2020, 1, 1, 0, 0);
    private static final LocalDateTime FUTURE = LocalDateTime.of(2099, 1, 1, 0, 0);

    @Autowired
    private PurchaseSearchJdbcAdapter adapter;

    @Autowired
    private JdbcTemplate jdbc;

    private long awaiting;   // Sede 1, Argos, 100.000, producto 1, 10-oct
    private long transit;    // Sede 1, La Paloma, 50.000, pagada a medias (con un pago anulado), vencida
    private long received;   // Sede 2, Argos, 300.000, pagada
    private long cancelled;  // Sede 1, Distribuidora, 80.000, cancelada (no debe nada)

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM pagos_orden_compra");
        jdbc.update("DELETE FROM detalles_orden_compra");
        jdbc.update("DELETE FROM ordenes_compra");
        awaiting = order(1, 1, "AWAITING_APPROVAL", "POR_PAGAR", "100000", LocalDateTime.of(2026, 10, 10, 9, 0), FUTURE, 1);
        transit = order(2, 1, "IN_TRANSIT", "PAGO_PARCIAL", "50000", LocalDateTime.of(2026, 10, 11, 23, 30), PAST, 2);
        received = order(1, 2, "RECEIVED_TOTAL", "PAGADO", "300000", LocalDateTime.of(2026, 10, 12, 8, 0), PAST, 3);
        cancelled = order(3, 1, "CANCELLED", "POR_PAGAR", "80000", LocalDateTime.of(2026, 10, 13, 8, 0), PAST, 1);
        payment(transit, "20000", false);
        payment(transit, "15000", true); // anulado: no cuenta
        payment(received, "300000", false);
    }

    private static PurchaseSearchPort.Criteria criteria(String status, Viewer viewer) {
        return new PurchaseSearchPort.Criteria(status, null, null, null, null, null, null, null, null, false, null, viewer);
    }

    private List<Long> ids(PurchaseSearchPort.Criteria criteria) {
        return adapter.search(criteria, new PageParams(0, 25), "id", false).content().stream().map(PurchaseSearchPort.Row::id).toList();
    }

    @Test
    @DisplayName("«en curso» deja fuera recibidas y canceladas; «todas» y un estado puntual también filtran")
    void filtraPorEstado() {
        assertThat(ids(criteria("open", ADMIN))).containsExactly(transit, awaiting);
        assertThat(ids(criteria("all", ADMIN))).containsExactly(cancelled, received, transit, awaiting);
        assertThat(ids(criteria("IN_TRANSIT", ADMIN))).containsExactly(transit);
    }

    @Test
    @DisplayName("filtra por pago, fechas (día «Hasta» completo), proveedor, sucursal, producto y total")
    void filtraPorCadaCampo() {
        assertThat(ids(new PurchaseSearchPort.Criteria("all", PaymentStatus.PAGADO, null, null, null, null, null, null, null, false, null, ADMIN))).containsExactly(received);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, LocalDate.of(2026, 10, 10), LocalDate.of(2026, 10, 11), null, null, null, null, null, false, null, ADMIN)))
                .containsExactly(transit, awaiting);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, 1L, null, null, null, null, false, null, ADMIN))).containsExactly(received, awaiting);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, null, 2L, null, null, null, false, null, ADMIN))).containsExactly(received);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, null, null, 3L, null, null, false, null, ADMIN))).containsExactly(received);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, null, null, null, new BigDecimal("60000"), new BigDecimal("100000"), false, null, ADMIN)))
                .containsExactly(cancelled, awaiting);
    }

    @Test
    @DisplayName("la búsqueda va por número de orden o proveedor, sin tildes")
    void busquedaPorNumeroOProveedor() {
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, null, null, null, null, null, false, "PALOMA", ADMIN))).containsExactly(transit);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, null, null, null, null, null, false, "#" + received, ADMIN))).contains(received);
        assertThat(ids(new PurchaseSearchPort.Criteria("all", null, null, null, null, null, null, null, null, false, "100%", ADMIN))).isEmpty();
    }

    @Test
    @DisplayName("ordena por la columna pedida y pagina; una columna fuera de la lista ordena por número")
    void ordenYPagina() {
        PurchaseSearchPort.Page second = adapter.search(criteria("all", ADMIN), new PageParams(1, 3), "total", true);
        assertThat(second.totalElements()).isEqualTo(4);
        assertThat(second.content()).extracting(PurchaseSearchPort.Row::id).containsExactly(received);
        assertThat(adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "supplier", true).content())
                .extracting(PurchaseSearchPort.Row::supplierName)
                .containsExactly("Cementos Argos S.A.", "Cementos Argos S.A.", "Distribuidora Nacional", "Ferretería La Paloma");
        assertThat(adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "id; DROP TABLE ordenes_compra", false).content())
                .extracting(PurchaseSearchPort.Row::id).containsExactly(cancelled, received, transit, awaiting);
    }

    @Test
    @DisplayName("el saldo y «vencida» coinciden con PurchaseOrder: los pagos anulados no cuentan y la cancelada no debe nada")
    void saldoCoincideConElDominio() {
        Map<Long, PurchaseSearchPort.Row> rows = adapter.search(criteria("all", ADMIN), new PageParams(0, 25), "id", true).content().stream()
                .collect(Collectors.toMap(PurchaseSearchPort.Row::id, Function.identity()));

        assertThat(rows.get(transit).balance()).isEqualByComparingTo(domain(transit).balance()).isEqualByComparingTo("30000");
        assertThat(rows.get(cancelled).balance()).isEqualByComparingTo(domain(cancelled).balance()).isEqualByComparingTo("0");
        assertThat(rows.get(received).balance()).isEqualByComparingTo(domain(received).balance()).isEqualByComparingTo("0");
        assertThat(rows.get(awaiting).balance()).isEqualByComparingTo(domain(awaiting).balance()).isEqualByComparingTo("100000");
        LocalDateTime now = LocalDateTime.now();
        for (long id : List.of(awaiting, transit, received, cancelled)) {
            assertThat(rows.get(id).overdue()).as("vencida #%d", id).isEqualTo(domain(id).isOverdue(now));
        }
        assertThat(rows.get(transit).branchName()).isEqualTo("Sede Central");
    }

    @Test
    @DisplayName("«te toca» en SQL coincide con PurchaseActionPolicy en todos los estados y roles (también el filtro «solo las mías»)")
    void awaitsMe_SQL_coincide_con_la_politica_para_todos_los_estados_y_roles() {
        jdbc.update("DELETE FROM pagos_orden_compra");
        jdbc.update("DELETE FROM detalles_orden_compra");
        jdbc.update("DELETE FROM ordenes_compra");
        Map<Long, ReceptionStatus> byId = new java.util.HashMap<>();
        for (ReceptionStatus status : ReceptionStatus.values()) {
            byId.put(order(1, 1, status.name(), "POR_PAGAR", "1000", LocalDateTime.of(2026, 10, 10, 9, 0), FUTURE, 1), status);
        }
        for (Viewer viewer : List.of(ADMIN, MANAGER, OPERADOR, SELLER)) {
            List<PurchaseSearchPort.Row> rows = adapter.search(criteria("all", viewer), new PageParams(0, 25), "id", true).content();
            assertThat(rows).hasSize(byId.size());
            for (PurchaseSearchPort.Row row : rows) {
                assertThat(row.awaitsMe()).as("%s con %s", row.reception(), viewer).isEqualTo(PurchaseActionPolicy.awaits(row.reception(), viewer));
            }
            List<ReceptionStatus> mine = adapter.search(new PurchaseSearchPort.Criteria("all", null, null, null, null, null, null, null, null, true, null, viewer),
                    new PageParams(0, 25), "id", true).content().stream().map(PurchaseSearchPort.Row::reception).toList();
            assertThat(mine).as("solo las mías con %s", viewer)
                    .containsExactlyInAnyOrderElementsOf(byId.values().stream().filter(s -> PurchaseActionPolicy.awaits(s, viewer)).toList());
        }
    }

    @Test
    @DisplayName("el resumen cuenta todo lo visible de la sucursal, sin importar la página")
    void summary_cuenta_todo_lo_visible() {
        PurchaseSearchPort.Summary all = adapter.summary(null, OPERADOR);
        assertThat(all.open()).isEqualTo(2);
        assertThat(all.awaitingMe()).isEqualTo(1); // el operador solo recibe la que viene en camino
        assertThat(all.owed()).isEqualByComparingTo("130000");
        assertThat(all.owedCount()).isEqualTo(2);
        assertThat(all.overdue()).isEqualTo(1);

        PurchaseSearchPort.Summary norte = adapter.summary(2L, ADMIN);
        assertThat(norte.open()).isZero();
        assertThat(norte.owed()).isEqualByComparingTo("0");
        assertThat(adapter.summary(1L, MANAGER).awaitingMe()).isEqualTo(2);
    }

    private PurchaseOrder domain(long id) {
        Map<String, Object> o = jdbc.queryForMap("SELECT * FROM ordenes_compra WHERE id = ?", id);
        List<PurchasePayment> payments = jdbc.query("SELECT * FROM pagos_orden_compra WHERE orden_id = ?", (rs, i) -> new PurchasePayment(
                rs.getLong("id"), rs.getBigDecimal("monto"), rs.getTimestamp("fecha").toLocalDateTime(), rs.getLong("usuario_id"), rs.getString("usuario_nombre"),
                PaymentMethod.valueOf(rs.getString("metodo")), null, null,
                rs.getTimestamp("anulado_en") == null ? null : rs.getTimestamp("anulado_en").toLocalDateTime(),
                (Long) rs.getObject("anulado_por_id", Long.class), rs.getString("anulado_por_nombre"), rs.getString("motivo_anulacion")), id);
        return new PurchaseOrder(id, 1L, 1L, 1L, null, ((java.sql.Timestamp) o.get("fecha_solicitud")).toLocalDateTime(), null, null, 3,
                ReceptionStatus.valueOf((String) o.get("estado_recepcion")), PaymentStatus.valueOf((String) o.get("estado_pago")), 30,
                ((java.sql.Timestamp) o.get("fecha_vencimiento_pago")).toLocalDateTime(), (BigDecimal) o.get("total"),
                List.of(new PurchaseOrderDetail(null, 1L, BigDecimal.ONE, BigDecimal.ONE, BigDecimal.ZERO, BigDecimal.ZERO)),
                null, null, null, false, 0, payments);
    }

    private long order(long supplier, long branch, String reception, String payment, String total, LocalDateTime requested, LocalDateTime due, long product) {
        long id = jdbc.queryForObject("""
                INSERT INTO ordenes_compra (proveedor_id, sucursal_id, usuario_id, fecha_solicitud, estado_recepcion, estado_pago, total,
                                            fecha_vencimiento_pago, plazo_pago_dias)
                VALUES (?, ?, 1, ?, ?, ?, ?, ?, 30) RETURNING id
                """, Long.class, supplier, branch, requested, reception, payment, new BigDecimal(total), due);
        jdbc.update("INSERT INTO detalles_orden_compra (orden_id, producto_id, cantidad, precio_unitario_pactado, subtotal) VALUES (?, ?, 1, ?, ?)",
                id, product, new BigDecimal(total), new BigDecimal(total));
        return id;
    }

    private void payment(long order, String amount, boolean voided) {
        jdbc.update("""
                INSERT INTO pagos_orden_compra (orden_id, monto, usuario_id, usuario_nombre, metodo, anulado_en, anulado_por_id, motivo_anulacion)
                VALUES (?, ?, 1, 'Admin', 'EFECTIVO', ?, ?, ?)
                """, order, new BigDecimal(amount), voided ? LocalDateTime.of(2026, 10, 20, 9, 0) : null, voided ? 1L : null, voided ? "error" : null);
    }
}
