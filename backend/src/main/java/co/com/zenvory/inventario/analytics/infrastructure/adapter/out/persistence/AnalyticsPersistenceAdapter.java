package co.com.zenvory.inventario.analytics.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.analytics.application.port.out.AnalyticsRepositoryPort;
import co.com.zenvory.inventario.analytics.domain.model.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
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
    private final NamedParameterJdbcTemplate namedParameterJdbcTemplate;

    public AnalyticsPersistenceAdapter(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
        this.namedParameterJdbcTemplate = new NamedParameterJdbcTemplate(jdbcTemplate);
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
        MapSqlParameterSource params = new MapSqlParameterSource();
        
        String branchFilter = "";
        if (branchId != null) {
            branchFilter = " AND sucursal_id = :branchId ";
            params.addValue("branchId", branchId);
        }

        String branchFilterV = "";
        if (branchId != null) {
            branchFilterV = " AND v.sucursal_id = :branchId ";
        }

        String invBranchFilter = "";
        if (branchId != null) {
            invBranchFilter = " AND i.sucursal_id = :branchId ";
        }

        String dateFilter = "";
        if (startDate != null) {
            dateFilter += " AND fecha >= :startDate ";
            params.addValue("startDate", startDate);
        }
        if (endDate != null) {
            dateFilter += " AND fecha <= :endDate ";
            params.addValue("endDate", endDate);
        }

        String dateFilterV = "";
        if (startDate != null) {
            dateFilterV += " AND v.fecha >= :startDate ";
        }
        if (endDate != null) {
            dateFilterV += " AND v.fecha <= :endDate ";
        }

        String query = String.format("""
                SELECT
                    (SELECT COALESCE(SUM(total_final), 0) FROM ventas WHERE estado = 'COMPLETED' %s %s) as total_revenue,
                    (SELECT COALESCE(SUM(dv.cantidad), 0) FROM detalles_venta dv JOIN ventas v ON dv.venta_id = v.id WHERE v.estado = 'COMPLETED' %s %s) as total_units,
                    (SELECT COALESCE(SUM(i.cantidad_actual * p.costo_promedio), 0)
                     FROM inventario_local i JOIN producto p ON i.producto_id = p.id WHERE 1=1 %s) as total_value,
                    (SELECT COALESCE(AVG(total_final), 0) FROM ventas WHERE estado = 'COMPLETED' %s %s) as avg_ticket,
                    (SELECT COUNT(*) FROM sucursal WHERE activa = true) as branch_count
                """,
                branchFilter, dateFilter,
                branchFilterV, dateFilterV,
                invBranchFilter,
                branchFilter, dateFilter);

        return namedParameterJdbcTemplate.queryForObject(query, params, (rs, rowNum) -> new GlobalSummary(
                rs.getBigDecimal("total_revenue"),
                rs.getBigDecimal("total_units"),
                rs.getBigDecimal("total_value"),
                rs.getBigDecimal("avg_ticket"),
                rs.getLong("branch_count")
        ));
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

    @Override
    public List<MonthlySales> findMonthlySales(Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT 
                    TO_CHAR(v.fecha, 'Month') as month_name,
                    EXTRACT(YEAR FROM v.fecha) as year_val,
                    SUM(v.total_final) as revenue,
                    SUM(dv.cantidad) as volume
                FROM ventas v
                JOIN detalles_venta dv ON v.id = dv.venta_id
                WHERE v.estado = 'COMPLETED'
                  AND v.fecha >= CURRENT_DATE - INTERVAL '6 months'
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND v.sucursal_id = ? ");
            args.add(branchId);
        }

        query.append(" GROUP BY year_val, month_name, EXTRACT(MONTH FROM v.fecha) ");
        query.append(" ORDER BY year_val DESC, EXTRACT(MONTH FROM v.fecha) DESC ");

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new MonthlySales(
                rs.getString("month_name").trim(),
                rs.getInt("year_val"),
                rs.getBigDecimal("revenue"),
                rs.getBigDecimal("volume")
        ), args.toArray());
    }

    @Override
    public List<InventoryRotation> findInventoryRotation(Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT 
                    p.id as product_id,
                    p.nombre as product_name,
                    COALESCE(SUM(dv.cantidad), 0) as sold_qty,
                    i.cantidad_actual as current_stock,
                    (CAST(COALESCE(SUM(dv.cantidad), 0) AS DECIMAL) / COALESCE(NULLIF(i.cantidad_actual, 0), 1)) as rotation,
                    (i.cantidad_actual > 0 AND COALESCE(SUM(dv.cantidad), 0) = 0) as dead_stock,
                    EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(MAX(v.fecha), i.last_updated)))::INT as inactive_days
                FROM producto p
                JOIN inventario_local i ON p.id = i.producto_id
                LEFT JOIN detalles_venta dv ON p.id = dv.producto_id
                LEFT JOIN ventas v ON dv.venta_id = v.id AND v.estado = 'COMPLETED'
                WHERE 1=1
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND i.sucursal_id = ? ");
            args.add(branchId);
        }

        query.append(" GROUP BY p.id, p.nombre, i.cantidad_actual, i.last_updated ");
        query.append(" ORDER BY rotation DESC ");

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new InventoryRotation(
                rs.getLong("product_id"),
                rs.getString("product_name"),
                rs.getBigDecimal("sold_qty"),
                rs.getBigDecimal("current_stock"),
                rs.getBigDecimal("rotation"),
                rs.getBoolean("dead_stock"),
                rs.getInt("inactive_days")
        ), args.toArray());
    }


    @Override
    public List<ReplenishmentInsight> findReplenishmentInsights(Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT 
                    p.id as product_id,
                    p.nombre as product_name,
                    i.cantidad_actual as current_stock,
                    i.stock_minimo as min_stock,
                    CASE 
                        WHEN i.cantidad_actual <= i.stock_minimo THEN 'HIGH'
                        WHEN i.cantidad_actual <= i.stock_minimo * 1.5 THEN 'MEDIUM'
                        ELSE 'LOW'
                    END as priority
                FROM producto p
                JOIN inventario_local i ON p.id = i.producto_id
                WHERE i.cantidad_actual <= i.stock_minimo * 1.5
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND i.sucursal_id = ? ");
            args.add(branchId);
        }

        query.append(" ORDER BY CAST(i.cantidad_actual AS DECIMAL) / COALESCE(NULLIF(i.stock_minimo, 0), 1) ASC ");

        return jdbcTemplate.query(query.toString(), (rs, rowNum) -> new ReplenishmentInsight(
                rs.getLong("product_id"),
                rs.getString("product_name"),
                rs.getBigDecimal("current_stock"),
                rs.getBigDecimal("min_stock"),
                rs.getString("priority")
        ), args.toArray());
    }

    @Override
    public TransferImpact findTransferImpact(Long branchId) {
        StringBuilder query = new StringBuilder("""
                SELECT 
                    COUNT(DISTINCT t.id) as active_count,
                    COALESCE(SUM(ti.cantidad_solicitada), 0) as total_items,
                    COALESCE(SUM(ti.cantidad_solicitada * p.costo_promedio), 0) as total_valuation
                FROM transferencias t
                JOIN detalles_transferencia ti ON t.id = ti.transferencia_id
                JOIN producto p ON ti.producto_id = p.id
                WHERE t.estado IN ('PENDIENTE', 'AUTHORIZED', 'IN_TRANSIT')
                """);
        List<Object> args = new ArrayList<>();

        if (branchId != null) {
            query.append(" AND (t.sucursal_origen_id = ? OR t.sucursal_destino_id = ?) ");
            args.add(branchId);
            args.add(branchId);
        }

        return jdbcTemplate.queryForObject(query.toString(), (rs, rowNum) -> new TransferImpact(
                rs.getInt("active_count"),
                rs.getBigDecimal("total_items"),
                rs.getBigDecimal("total_valuation")
        ), args.toArray());
    }
}
