package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.application.port.out.MovementPage;
import co.com.zenvory.inventario.inventory.application.port.out.MovementRecord;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
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

import static org.assertj.core.api.Assertions.assertThat;

/**
 * La auditoría de movimientos contra un PostgreSQL real con las migraciones (sucursales 1-3, usuarios 1-3 y productos
 * 1-5 vienen del seed V2). Sin Docker la clase se omite.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(MovementSearchJdbcAdapter.class)
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("MovementSearchJdbcAdapter — auditoría paginada en la base")
class MovementSearchJdbcAdapterTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private MovementSearchJdbcAdapter adapter;

    @Autowired
    private JdbcTemplate jdbc;

    private static final MovementSearchCriteria ALL = criteria(null, null, null, null, null, null, false, null);

    private long sale;
    private long purchase;
    private long shrinkage;
    private long transferOut;

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM movimiento_inventario");
        // Sede 1: una venta (Cemento, usuario 1) y una compra (Varilla, usuario 2). Sede 2: una merma con observación y un traslado.
        sale = movement(1, 1, 1, "RETIRO", "VENTA", "3", LocalDateTime.of(2026, 10, 12, 9, 0), "VENTA", 41L, null);
        purchase = movement(1, 2, 2, "INGRESO", "COMPRA", "50", LocalDateTime.of(2026, 10, 13, 23, 30), "ORDEN_COMPRA", 7L, null);
        shrinkage = movement(2, 3, 3, "RETIRO", "MERMA", "2", LocalDateTime.of(2026, 10, 14, 10, 0), null, null, "Revisión de bodega: piezas rotas");
        transferOut = movement(2, 1, 2, "RETIRO", "TRASLADO", "10", LocalDateTime.of(2026, 10, 15, 8, 0), "TRASLADO", 5L, null);
    }

    @Test
    @DisplayName("sin filtros: todos, del más reciente al más antiguo, con los nombres y lo que entró y salió")
    void noFilters_newestFirstWithNamesAndTotals() {
        MovementPage page = adapter.search(ALL, 0, 25, "date", false);

        assertThat(ids(page.content())).containsExactly(transferOut, shrinkage, purchase, sale);
        assertThat(page.totalElements()).isEqualTo(4);
        assertThat(page.totalIn()).isEqualByComparingTo("50");
        assertThat(page.totalOut()).isEqualByComparingTo("15");
        MovementRecord first = page.content().get(0);
        assertThat(first.productName()).isEqualTo("Cemento Gris 50Kg");
        assertThat(first.branchName()).isEqualTo("Sucursal Norte");
        assertThat(first.userName()).isEqualTo("Gerente Norte");
    }

    @Test
    @DisplayName("pagina en la base: el total y los totales abarcan todo, no solo la página")
    void paginates_totalsCoverEverything() {
        MovementPage second = adapter.search(ALL, 1, 3, "date", false);

        assertThat(ids(second.content())).containsExactly(sale);
        assertThat(second.totalElements()).isEqualTo(4);
        assertThat(second.totalOut()).isEqualByComparingTo("15");
    }

    @Test
    @DisplayName("filtra por sucursal, tipo, motivo, producto, responsable y cantidad")
    void filtersByEachField() {
        assertThat(ids(adapter.search(criteria(2L, null, null, null, null, null, false, null), 0, 25, "date", false).content()))
                .containsExactlyInAnyOrder(shrinkage, transferOut);
        assertThat(ids(adapter.search(new MovementSearchCriteria(null, MovementType.INGRESO, null, null, null, null, null, null, null, false, null), 0, 25, "date", false).content()))
                .containsExactly(purchase);
        assertThat(ids(adapter.search(new MovementSearchCriteria(null, null, List.of(MovementReason.MERMA), null, null, null, null, null, null, false, null), 0, 25, "date", false).content()))
                .containsExactly(shrinkage);
        assertThat(ids(adapter.search(new MovementSearchCriteria(null, null, null, null, null, List.of(1L), 2L, null, null, false, null), 0, 25, "date", false).content()))
                .containsExactly(transferOut);
        assertThat(ids(adapter.search(new MovementSearchCriteria(null, null, null, null, null, null, null, new BigDecimal("3"), new BigDecimal("10"), false, null), 0, 25, "date", false).content()))
                .containsExactlyInAnyOrder(sale, transferOut);
    }

    @Test
    @DisplayName("el día «Hasta» se incluye completo (una compra de las 23:30 entra)")
    void dateRange_includesWholeLastDay() {
        MovementSearchCriteria range = new MovementSearchCriteria(null, null, null, LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 13), null, null, null, null, false, null);

        assertThat(ids(adapter.search(range, 0, 25, "date", false).content())).containsExactly(purchase, sale);
    }

    @Test
    @DisplayName("solo los que tienen observaciones")
    void onlyObserved() {
        assertThat(ids(adapter.search(criteria(null, null, null, null, null, null, true, null), 0, 25, "date", false).content()))
                .containsExactly(shrinkage);
    }

    @Test
    @DisplayName("la búsqueda no distingue tildes ni mayúsculas y busca en producto, responsable, observaciones y documento")
    void textSearch() {
        assertThat(ids(search("REVISION"))).containsExactly(shrinkage);   // observación con tilde
        assertThat(ids(search("varilla"))).containsExactly(purchase);     // producto
        assertThat(ids(search("operador"))).containsExactly(shrinkage);   // responsable
        assertThat(ids(search("venta #41"))).containsExactly(sale);       // documento y su número
        assertThat(ids(search("cemento traslado"))).containsExactly(transferOut); // cada palabra en algún campo
        assertThat(search("100%")).isEmpty();                             // los comodines de LIKE no cuentan como tales
    }

    @Test
    @DisplayName("ordena por la columna pedida y no acepta columnas fuera de la lista (ordena por fecha)")
    void sorting() {
        assertThat(ids(adapter.search(ALL, 0, 25, "quantity", true).content())).containsExactly(transferOut, sale, shrinkage, purchase);
        assertThat(ids(adapter.search(ALL, 0, 25, "id; DROP TABLE movimiento_inventario", false).content()))
                .containsExactly(transferOut, shrinkage, purchase, sale);
    }

    @Test
    @DisplayName("exportar trae todo lo filtrado, hasta el límite")
    void export_respectsFiltersAndLimit() {
        assertThat(ids(adapter.findAll(criteria(2L, null, null, null, null, null, false, null), "date", false, 100))).containsExactly(transferOut, shrinkage);
        assertThat(adapter.findAll(ALL, "date", false, 3)).hasSize(3);
    }

    private List<MovementRecord> search(String text) {
        return adapter.search(criteria(null, null, null, null, null, null, false, text), 0, 25, "date", false).content();
    }

    @Test
    @DisplayName("filtra por varios productos y varios motivos a la vez (el kardex los permite)")
    void filtraVariosProductosYMotivos() {
        assertThat(ids(adapter.search(new MovementSearchCriteria(null, null, null, null, null, List.of(1L, 3L), null, null, null, false, null), 0, 25, "date", false).content()))
                .containsExactlyInAnyOrder(sale, shrinkage, transferOut);
        assertThat(ids(adapter.search(new MovementSearchCriteria(null, null, List.of(MovementReason.VENTA, MovementReason.MERMA), null, null, null, null, null, null, false, null), 0, 25, "date", false).content()))
                .containsExactlyInAnyOrder(sale, shrinkage);
        // Una lista vacía no filtra.
        assertThat(adapter.search(new MovementSearchCriteria(null, null, List.of(), null, null, List.of(), null, null, null, false, null), 0, 25, "date", false).totalElements())
                .isEqualTo(4);
    }

    private static MovementSearchCriteria criteria(Long branch, MovementType type, MovementReason reason, LocalDate from, LocalDate to,
                                                   Long product, boolean onlyObserved, String text) {
        return new MovementSearchCriteria(branch, type, reason == null ? null : List.of(reason), from, to, product == null ? null : List.of(product), null, null, null, onlyObserved, text);
    }

    private long movement(long branch, long product, long user, String type, String reason, String quantity, LocalDateTime date,
                          String referenceType, Long referenceId, String observations) {
        return jdbc.queryForObject("""
                INSERT INTO movimiento_inventario (sucursal_id, producto_id, usuario_id, tipo, motivo, cantidad, fecha,
                                                   tipo_referencia, referencia_id, observaciones, saldo_final)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0) RETURNING id
                """, Long.class, branch, product, user, type, reason, new BigDecimal(quantity), date, referenceType, referenceId, observations);
    }

    private static List<Long> ids(List<MovementRecord> records) {
        return records.stream().map(r -> r.movement().getId()).toList();
    }
}
