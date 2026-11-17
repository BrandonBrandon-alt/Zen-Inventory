package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort;
import co.com.zenvory.inventario.purchase.domain.model.PaymentStatus;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.persistence.SqlText;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * La lista de compras con SQL directo. El saldo repite {@code PurchaseOrder.balance()} (los pagos anulados no cuentan,
 * una orden cancelada no debe nada) y «te toca» repite {@code PurchaseActionPolicy}; las pruebas comparan ambos.
 * Lee {@code proveedor} y {@code sucursal} de otros módulos para buscar y ordenar por nombre.
 */
@Component
public class PurchaseSearchJdbcAdapter implements PurchaseSearchPort {

    /** Cada orden con su proveedor, su sucursal y su saldo calculado una sola vez. */
    private static final String FROM = """
             FROM (SELECT o.id, o.proveedor_id, o.sucursal_id, o.estado_recepcion, o.estado_pago, o.total, o.fecha_solicitud,
                          o.fecha_vencimiento_pago, pr.nombre AS proveedor_nombre, s.nombre AS sucursal_nombre,
                          CASE WHEN o.estado_recepcion = 'CANCELLED' THEN 0
                               ELSE GREATEST(o.total - COALESCE((SELECT SUM(pg.monto) FROM pagos_orden_compra pg
                                                                  WHERE pg.orden_id = o.id AND pg.anulado_en IS NULL), 0), 0)
                          END AS saldo
                     FROM ordenes_compra o
                     LEFT JOIN proveedor pr ON pr.id = o.proveedor_id
                     LEFT JOIN sucursal s ON s.id = o.sucursal_id) q
            """;

    private static final String OPEN = "q.estado_recepcion IN ('AWAITING_APPROVAL', 'PENDING', 'IN_TRANSIT', 'RECEIVED_PARTIAL')";
    private static final String OVERDUE = "(q.saldo > 0 AND q.fecha_vencimiento_pago < ?)";

    private static final Map<String, String> SORTS = Map.of(
            "id", "q.id",
            "reception", "q.estado_recepcion",
            "supplier", "q.proveedor_nombre",
            "branch", "q.sucursal_nombre",
            "total", "q.total",
            "balance", "q.saldo",
            "payment", "q.estado_pago",
            "requestDate", "q.fecha_solicitud");

    private static final int MAX_SEARCH_WORDS = 5;

    private final JdbcTemplate jdbc;

    public PurchaseSearchJdbcAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** La regla de {@code PurchaseActionPolicy} en SQL; los permisos de quien mira entran como literales booleanos. */
    static String awaits(Viewer viewer) {
        return "((q.estado_recepcion = 'AWAITING_APPROVAL' AND " + viewer.manager() + ")"
                + " OR (q.estado_recepcion = 'IN_TRANSIT' AND " + viewer.operational() + "))";
    }

    @Override
    @Transactional(readOnly = true)
    public Page search(Criteria criteria, PageParams page, String sortBy, boolean ascending) {
        List<Object> args = new ArrayList<>();
        String where = where(criteria, args);
        Long total = jdbc.queryForObject("SELECT COUNT(*)" + FROM + where, Long.class, args.toArray());

        List<Object> pageArgs = new ArrayList<>();
        pageArgs.add(Timestamp.valueOf(LocalDateTime.now()));
        pageArgs.addAll(args);
        pageArgs.add(page.size());
        pageArgs.add((long) page.page() * page.size());
        String direction = ascending ? "ASC" : "DESC";
        String order = " ORDER BY " + SORTS.getOrDefault(sortBy, "q.id") + " " + direction + " NULLS LAST, q.id " + direction;
        List<Row> content = jdbc.query("SELECT q.*, " + OVERDUE + " AS vencida, " + awaits(criteria.viewer()) + " AS me_toca"
                + FROM + where + order + " LIMIT ? OFFSET ?", ROW, pageArgs.toArray());
        return new Page(content, total == null ? 0 : total);
    }

    @Override
    @Transactional(readOnly = true)
    public Summary summary(Long branchId, Viewer viewer) {
        List<Object> args = new ArrayList<>();
        args.add(Timestamp.valueOf(LocalDateTime.now()));
        String where = " WHERE 1 = 1";
        if (branchId != null) {
            where += " AND q.sucursal_id = ?";
            args.add(branchId);
        }
        return jdbc.queryForObject("SELECT COUNT(*) FILTER (WHERE " + OPEN + ") AS abiertas,"
                        + " COUNT(*) FILTER (WHERE " + awaits(viewer) + ") AS me_tocan,"
                        + " COALESCE(SUM(q.saldo) FILTER (WHERE q.saldo > 0), 0) AS deuda,"
                        + " COUNT(*) FILTER (WHERE q.saldo > 0) AS con_deuda,"
                        + " COUNT(*) FILTER (WHERE " + OVERDUE + ") AS vencidas"
                        + FROM + where,
                (rs, i) -> new Summary(rs.getLong("abiertas"), rs.getLong("me_tocan"), rs.getBigDecimal("deuda"), rs.getLong("con_deuda"), rs.getLong("vencidas")),
                args.toArray());
    }

    private static String where(Criteria c, List<Object> args) {
        StringBuilder sql = new StringBuilder(" WHERE 1 = 1");
        String status = c.status() == null ? "open" : c.status();
        if (status.equals("open")) {
            sql.append(" AND ").append(OPEN);
        } else if (!status.equals("all")) {
            sql.append(" AND q.estado_recepcion = ?");
            args.add(ReceptionStatus.valueOf(status).name());
        }
        if (c.payment() != null) {
            sql.append(" AND q.estado_pago = ?");
            args.add(c.payment().name());
        }
        if (c.from() != null) {
            sql.append(" AND q.fecha_solicitud >= ?");
            args.add(Timestamp.valueOf(c.from().atStartOfDay()));
        }
        if (c.to() != null) {
            // «Hasta» incluye el día completo.
            sql.append(" AND q.fecha_solicitud < ?");
            args.add(Timestamp.valueOf(c.to().plusDays(1).atStartOfDay()));
        }
        if (c.supplierId() != null) {
            sql.append(" AND q.proveedor_id = ?");
            args.add(c.supplierId());
        }
        if (c.branchId() != null) {
            sql.append(" AND q.sucursal_id = ?");
            args.add(c.branchId());
        }
        if (c.productId() != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM detalles_orden_compra d WHERE d.orden_id = q.id AND d.producto_id = ?)");
            args.add(c.productId());
        }
        if (c.minTotal() != null) {
            sql.append(" AND q.total >= ?");
            args.add(c.minTotal());
        }
        if (c.maxTotal() != null) {
            sql.append(" AND q.total <= ?");
            args.add(c.maxTotal());
        }
        if (c.onlyMine()) {
            sql.append(" AND ").append(awaits(c.viewer()));
        }
        // Cada palabra, en el número de la orden o en el proveedor.
        for (String word : SqlText.words(c.text(), MAX_SEARCH_WORDS)) {
            String like = SqlText.containsPattern(word);
            sql.append(" AND (CAST(q.id AS TEXT) LIKE ? OR ").append(SqlText.plain("q.proveedor_nombre")).append(" LIKE ?)");
            args.add(like);
            args.add(like);
        }
        return sql.toString();
    }

    private static final RowMapper<Row> ROW = (rs, i) -> new Row(
            rs.getLong("id"),
            ReceptionStatus.valueOf(rs.getString("estado_recepcion")),
            PaymentStatus.valueOf(rs.getString("estado_pago")),
            rs.getLong("proveedor_id"),
            rs.getString("proveedor_nombre"),
            rs.getLong("sucursal_id"),
            rs.getString("sucursal_nombre"),
            rs.getBigDecimal("total"),
            rs.getBigDecimal("saldo"),
            rs.getBoolean("vencida"),
            rs.getTimestamp("fecha_solicitud").toLocalDateTime(),
            rs.getBoolean("me_toca"));
}
