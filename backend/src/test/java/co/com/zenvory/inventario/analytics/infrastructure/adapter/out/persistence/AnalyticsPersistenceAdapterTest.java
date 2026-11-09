package co.com.zenvory.inventario.analytics.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.InventoryRotation;
import co.com.zenvory.inventario.analytics.domain.model.MonthlySales;
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
 * Consultas de analítica contra un PostgreSQL real con las migraciones de Flyway (sucursales 1-3, usuario 1 y
 * productos 1-2 vienen del seed V2). Sin Docker disponible la clase se omite.
 */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(AnalyticsPersistenceAdapter.class)
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("AnalyticsPersistenceAdapter — consultas SQL")
class AnalyticsPersistenceAdapterTest {

    private static final String[] MESES = {"Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
            "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"};

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private AnalyticsPersistenceAdapter adapter;

    @Autowired
    private JdbcTemplate jdbc;

    @Test
    @DisplayName("rendimiento por sede: solo cuenta las ventas dentro del periodo")
    void branchPerformance_onlyCountsSalesInsidePeriod() {
        sale(1L, LocalDateTime.of(2026, 1, 10, 10, 0), "1000.00", 1, 1);
        sale(2L, LocalDateTime.of(2026, 3, 5, 10, 0), "300.00", 1, 1, 1);

        Map<Long, BranchPerformance> result = byBranch(
                adapter.findBranchPerformance(LocalDateTime.of(2026, 3, 1, 0, 0), null, null));

        assertThat(result.get(1L).revenue()).isEqualByComparingTo("0");
        assertThat(result.get(1L).salesCount()).isZero();
        assertThat(result.get(2L).revenue()).isEqualByComparingTo("300.00");
        assertThat(result.get(2L).salesCount()).isEqualTo(1);
        assertThat(result.get(2L).unitsSold()).isEqualByComparingTo("3");
    }

    @Test
    @DisplayName("rendimiento por sede: el total de una venta no se multiplica por sus líneas")
    void branchPerformance_doesNotMultiplyRevenueByLines() {
        sale(1L, LocalDateTime.of(2026, 1, 10, 10, 0), "1000.00", 2, 3);

        BranchPerformance central = byBranch(adapter.findBranchPerformance(null, null, null)).get(1L);

        assertThat(central.revenue()).isEqualByComparingTo("1000.00");
        assertThat(central.unitsSold()).isEqualByComparingTo("5");
        assertThat(central.salesCount()).isEqualTo(1);
    }

    @Test
    @DisplayName("ventas mensuales: meses en español, del más antiguo al más reciente, sin multiplicar el total por las líneas")
    void monthlySales_spanishNamesChronologicalAndNotMultiplied() {
        LocalDate thisMonth = LocalDate.now().withDayOfMonth(1);
        LocalDate lastMonth = thisMonth.minusMonths(1);
        sale(1L, thisMonth.atTime(10, 0), "500.00", 1, 1);
        sale(2L, lastMonth.atTime(10, 0), "200.00", 4);

        List<MonthlySales> result = adapter.findMonthlySales(null);

        assertThat(result).extracting(MonthlySales::monthName)
                .containsExactly(MESES[lastMonth.getMonthValue() - 1], MESES[thisMonth.getMonthValue() - 1]);
        assertThat(result).extracting(MonthlySales::year).containsExactly(lastMonth.getYear(), thisMonth.getYear());
        assertThat(result.get(1).revenue()).isEqualByComparingTo("500.00");
        assertThat(result.get(1).volume()).isEqualByComparingTo("2");
    }

    @Test
    @DisplayName("rotación por sede: solo cuenta las ventas completadas de esa sede")
    void inventoryRotation_onlyCountsCompletedSalesOfTheBranch() {
        // Producto 2 (seed V2): 10 unidades en la sede 1 y 800 en la 2.
        saleOf(1L, 2L, "COMPLETED", 3);
        saleOf(2L, 2L, "COMPLETED", 7);
        saleOf(1L, 2L, "CANCELED", 100);

        InventoryRotation rebar = rotationOf(adapter.findInventoryRotation(1L), 2L);

        assertThat(rebar.soldQuantity()).isEqualByComparingTo("3");
        assertThat(rebar.rotationRatio()).isEqualByComparingTo("0.3");
        assertThat(rebar.isDeadStock()).isFalse();
    }

    @Test
    @DisplayName("rotación por sede: un producto que solo se vende en otra sede es inventario sin movimiento aquí")
    void inventoryRotation_salesOfAnotherBranchDoNotHideDeadStock() {
        saleOf(2L, 2L, "COMPLETED", 7);

        InventoryRotation rebar = rotationOf(adapter.findInventoryRotation(1L), 2L);

        assertThat(rebar.soldQuantity()).isEqualByComparingTo("0");
        assertThat(rebar.isDeadStock()).isTrue();
    }

    /** Venta con una sola línea del producto y en el estado dados. */
    private void saleOf(Long branchId, Long productId, String status, int quantity) {
        Long saleId = jdbc.queryForObject("""
                INSERT INTO ventas (sucursal_id, usuario_id, fecha, subtotal, total_final, estado)
                VALUES (?, 1, ?, 0, 0, ?) RETURNING id
                """, Long.class, branchId, LocalDateTime.of(2026, 3, 5, 10, 0), status);
        jdbc.update("""
                INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario_aplicado, subtotal_linea)
                VALUES (?, ?, ?, 0, 0)
                """, saleId, productId, quantity);
    }

    private static InventoryRotation rotationOf(List<InventoryRotation> rows, Long productId) {
        return rows.stream().filter(row -> row.productId().equals(productId)).findFirst().orElseThrow();
    }

    /** Venta completada con una línea (producto 1) por cada cantidad dada. */
    private void sale(Long branchId, LocalDateTime date, String total, int... quantities) {
        Long saleId = jdbc.queryForObject("""
                INSERT INTO ventas (sucursal_id, usuario_id, fecha, subtotal, total_final, estado)
                VALUES (?, 1, ?, ?, ?, 'COMPLETED') RETURNING id
                """, Long.class, branchId, date, new BigDecimal(total), new BigDecimal(total));
        for (int quantity : quantities) {
            jdbc.update("""
                    INSERT INTO detalles_venta (venta_id, producto_id, cantidad, precio_unitario_aplicado, subtotal_linea)
                    VALUES (?, 1, ?, 0, 0)
                    """, saleId, quantity);
        }
    }

    private static Map<Long, BranchPerformance> byBranch(List<BranchPerformance> rows) {
        return rows.stream().collect(Collectors.toMap(BranchPerformance::branchId, Function.identity()));
    }
}
