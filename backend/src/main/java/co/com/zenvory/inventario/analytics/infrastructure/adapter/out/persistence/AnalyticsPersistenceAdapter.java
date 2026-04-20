package co.com.zenvory.inventario.analytics.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.analytics.application.port.out.AnalyticsRepositoryPort;
import co.com.zenvory.inventario.analytics.domain.model.BranchPerformance;
import co.com.zenvory.inventario.analytics.domain.model.BranchValuation;
import co.com.zenvory.inventario.analytics.domain.model.GlobalSummary;
import co.com.zenvory.inventario.analytics.domain.model.TopSellingProduct;
import co.com.zenvory.inventario.analytics.domain.model.SalesTrend;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Adaptador de salida (Secondary Adapter) que implementa la persistencia de analítica.
 * 
 * <p>Utiliza {@link JdbcTemplate} para ejecutar consultas SQL directas sobre el esquema relacional,
 * permitiendo realizar agregaciones complejas (SUM, AVG) que serían menos eficientes vía JPA tradicional.</p>
 * 
 * <p>Las consultas están optimizadas para filtrar por sucursal y rango de fechas dinámicamente.</p>
 */
@Component
public class AnalyticsPersistenceAdapter implements AnalyticsRepositoryPort {

    private final JdbcTemplate jdbcTemplate;

    /**
     * Constructor con inyección de JdbcTemplate.
     * 
     * @param jdbcTemplate Motor de ejecución de consultas SQL de Spring.
     */
    public AnalyticsPersistenceAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * {@inheritDoc}
     * <p>Consulta SQL: Agrupa la tabla 'detalles_venta' por producto, filtrando ventas completadas 
     * en el periodo y sucursal especificados.</p>
     */
    @Override
    public List<TopSellingProduct> findTopSellingProducts(int limit, LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT p.id as product_id, p.nombre as product_name, SUM(d.cantidad) as total_sold
                FROM detalles_venta d
                JOIN producto p ON d.producto_id = p.id
                JOIN ventas v ON d.venta_id = v.id
                WHERE v.estado = 'COMPLETED'
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND v.sucursal_id = ? ");
            args.add(branchId);
        }
        if (startDate != null) {
            query.append(" AND v.fecha >= ? ");
            args.add(startDate);
        }
        if (endDate != null) {
            query.append(" AND v.fecha <= ? ");
            args.add(endDate);
        }

        query.append(" GROUP BY p.id, p.nombre ORDER BY total_sold DESC LIMIT ? ");
        args.add(limit);

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new TopSellingProduct(
                rs.getLong("product_id"),
                rs.getString("product_name"),
                rs.getBigDecimal("total_sold")
        ), args.toArray());
    }

    /**
     * {@inheritDoc}
     * <p>Consulta SQL: Calcula el valor monetario del inventario actual multiplicando 'cantidad_actual' 
     * por 'costo_promedio' de los productos.</p>
     */
    @Override
    public List<BranchValuation> findBranchValuations(Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT s.id as branch_id, s.nombre as branch_name, SUM(i.cantidad_actual * p.costo_promedio) as total_value
                FROM inventario_local i
                JOIN sucursal s ON i.sucursal_id = s.id
                JOIN producto p ON i.producto_id = p.id
                WHERE 1=1
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND s.id = ? ");
            args.add(branchId);
        }

        query.append(" GROUP BY s.id, s.nombre ORDER BY total_value DESC ");

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new BranchValuation(
                rs.getLong("branch_id"),
                rs.getString("branch_name"),
                rs.getBigDecimal("total_value")
        ), args.toArray());
    }

    /**
     * {@inheritDoc}
     * <p>Consulta SQL: Ejecuta sub-consultas correlacionadas para obtener ingresos, unidades vendidas, 
     * valor de activos y ticket promedio en una sola fila de resultados.</p>
     */
    @Override
    public GlobalSummary findGlobalSummary(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        List<Object> args = new ArrayList<>();

        String startDateFilter = startDate != null ? " AND fecha >= ? " : "";
        String endDateFilter   = endDate   != null ? " AND fecha <= ? " : "";
        String startDateFilterV = startDate != null ? " AND v.fecha >= ? " : "";
        String endDateFilterV   = endDate   != null ? " AND v.fecha <= ? " : "";
        String branchSuffix    = branchId != null ? " AND sucursal_id = ? " : "";
        String branchSuffixV   = branchId != null ? " AND v.sucursal_id = ? " : "";
        String invBranchFilter = branchId != null ? " AND i.sucursal_id = ? " : "";
        String statusFilter    = " AND estado = 'COMPLETED' ";
        String statusFilterV   = " AND v.estado = 'COMPLETED' ";

        // total_revenue
        if (branchId != null) args.add(branchId);
        if (startDate != null) args.add(startDate);
        if (endDate   != null) args.add(endDate);
        // total_units
        if (branchId != null) args.add(branchId);
        if (startDate != null) args.add(startDate);
        if (endDate   != null) args.add(endDate);
        // total_value (inventario_local, no date filter)
        if (branchId != null) args.add(branchId);
        // avg_ticket
        if (branchId != null) args.add(branchId);
        if (startDate != null) args.add(startDate);
        if (endDate   != null) args.add(endDate);

        String query = String.format("""
                SELECT
                    (SELECT COALESCE(SUM(total_final), 0) FROM ventas WHERE 1=1 %s%s%s) as total_revenue,
                    (SELECT COALESCE(SUM(dv.cantidad), 0) FROM detalles_venta dv JOIN ventas v ON dv.venta_id = v.id WHERE 1=1 %s%s%s) as total_units,
                    (SELECT COALESCE(SUM(i.cantidad_actual * p.costo_promedio), 0)
                     FROM inventario_local i JOIN producto p ON i.producto_id = p.id WHERE 1=1 %s) as total_value,
                    (SELECT COALESCE(AVG(total_final), 0) FROM ventas WHERE 1=1 %s%s%s) as avg_ticket,
                    (SELECT COUNT(*) FROM sucursal WHERE activa = true) as branch_count
                """,
                branchSuffix, statusFilter, startDateFilter, endDateFilter,
                branchSuffixV, statusFilterV, startDateFilterV, endDateFilterV,
                invBranchFilter,
                branchSuffix, statusFilter, startDateFilter, endDateFilter);

        return jdbcTemplate.queryForObject(query, (rs, rowNum) -> new GlobalSummary(
                rs.getBigDecimal("total_revenue"),
                rs.getBigDecimal("total_units"),
                rs.getBigDecimal("total_value"),
                rs.getBigDecimal("avg_ticket"),
                rs.getLong("branch_count")
        ), args.toArray());

    }

    /**
     * {@inheritDoc}
     * <p>Consulta SQL: Realiza LEFT JOINs entre sucursales y ventas para asegurar que incluso 
     * las sucursales sin ventas aparezcan en el reporte (con valor cero).</p>
     */
    @Override
    public List<BranchPerformance> findBranchPerformance(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT
                    s.id as branch_id,
                    s.nombre as branch_name,
                    COALESCE(SUM(v.total_final), 0) as revenue,
                    COALESCE(SUM(dv.cantidad), 0) as units_sold,
                    COUNT(DISTINCT v.id) as sales_count
                FROM sucursal s
                LEFT JOIN ventas v ON s.id = v.sucursal_id AND v.estado = 'COMPLETED'
                LEFT JOIN detalles_venta dv ON v.id = dv.venta_id
                """);

        List<Object> args = new ArrayList<>();

        if (startDate != null || endDate != null || branchId != null) {
            query.append(" AND (1=1 ");
            if (branchId != null) {
                query.append(" AND s.id = ? ");
                args.add(branchId);
            }
            if (startDate != null) {
                query.append(" AND v.fecha >= ? ");
                args.add(startDate);
            }
            if (endDate != null) {
                query.append(" AND v.fecha <= ? ");
                args.add(endDate);
            }
            query.append(") ");
        }

        query.append("""
                WHERE s.activa = true
                """);

        if (branchId != null) {
            query.append(" AND s.id = ? ");
            args.add(branchId);
        }

        query.append(" GROUP BY s.id, s.nombre ORDER BY revenue DESC ");

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new BranchPerformance(
                rs.getLong("branch_id"),
                rs.getString("branch_name"),
                rs.getBigDecimal("revenue"),
                rs.getBigDecimal("units_sold"),
                rs.getLong("sales_count")
        ), args.toArray());
    }

    /**
     * {@inheritDoc}
     * <p>Consulta SQL: Agrupa las ventas por fecha (truncando la hora) para visualizar 
     * la evolución diaria de los ingresos.</p>
     */
    @Override
    public List<SalesTrend> findSalesTrend(LocalDateTime startDate, LocalDateTime endDate, Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT CAST(v.fecha AS DATE) as sale_date, SUM(v.total_final) as revenue
                FROM ventas v
                WHERE v.estado = 'COMPLETED'
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND v.sucursal_id = ? ");
            args.add(branchId);
        }
        if (startDate != null) {
            query.append(" AND v.fecha >= ? ");
            args.add(startDate);
        }
        if (endDate != null) {
            query.append(" AND v.fecha <= ? ");
            args.add(endDate);
        }

        query.append(" GROUP BY CAST(v.fecha AS DATE) ORDER BY sale_date ");

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new SalesTrend(
                rs.getDate("sale_date").toLocalDate(),
                rs.getBigDecimal("revenue")
        ), args.toArray());
    }
}
