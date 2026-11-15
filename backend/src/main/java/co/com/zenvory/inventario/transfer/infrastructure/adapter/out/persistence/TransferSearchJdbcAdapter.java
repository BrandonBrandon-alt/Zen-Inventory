package co.com.zenvory.inventario.transfer.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.persistence.SqlText;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort;
import co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus;
import co.com.zenvory.inventario.transfer.domain.model.TransferPriority;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * La lista de traslados con SQL directo. El flete repite {@code Transfer.freightBalance()} y
 * {@code freightPaymentStatus()} (los pagos anulados no cuentan; sin despacho o sin costo no se debe nada) y «te toca»
 * repite {@code TransferActionPolicy}; las pruebas comparan ambos. Lee {@code sucursal} y {@code producto} de otros
 * módulos para buscar y ordenar por nombre.
 */
@Component
public class TransferSearchJdbcAdapter implements TransferSearchPort {

    /** Cada traslado con sus sucursales, su primer producto y su flete calculados una sola vez. */
    private static final String FROM = """
             FROM (SELECT f.*,
                          CASE WHEN NOT f.con_costo THEN 'SIN_COSTO'
                               WHEN f.saldo_flete = 0 THEN 'PAGADO'
                               WHEN f.pagado = 0 THEN 'POR_PAGAR'
                               ELSE 'PAGO_PARCIAL' END AS estado_flete
                     FROM (SELECT t.id, t.estado, t.prioridad, t.sucursal_origen_id, t.sucursal_destino_id, t.fecha_solicitud,
                                  so.nombre AS origen_nombre, sd.nombre AS destino_nombre,
                                  (SELECT COALESCE(d.producto_nombre, p.nombre) FROM detalles_transferencia d
                                     LEFT JOIN producto p ON p.id = d.producto_id
                                    WHERE d.transferencia_id = t.id ORDER BY d.id LIMIT 1) AS primer_producto,
                                  (SELECT COUNT(*) FROM detalles_transferencia d WHERE d.transferencia_id = t.id) AS cantidad_productos,
                                  (t.fecha_despacho IS NOT NULL AND COALESCE(t.costo_envio, 0) > 0) AS con_costo,
                                  pg.pagado,
                                  CASE WHEN t.fecha_despacho IS NULL OR COALESCE(t.costo_envio, 0) <= 0 THEN 0
                                       ELSE GREATEST(t.costo_envio - pg.pagado, 0) END AS saldo_flete
                             FROM transferencias t
                             LEFT JOIN sucursal so ON so.id = t.sucursal_origen_id
                             LEFT JOIN sucursal sd ON sd.id = t.sucursal_destino_id
                             CROSS JOIN LATERAL (SELECT COALESCE(SUM(x.monto), 0) AS pagado FROM pagos_traslado x
                                                  WHERE x.traslado_id = t.id AND x.anulado_en IS NULL) pg) f) q
            """;

    private static final String OPEN = "q.estado IN ('PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT', 'WITH_ISSUE', 'UNDER_CLAIM')";

    private static final Map<String, String> SORTS = Map.of(
            "id", "q.id",
            "status", "q.estado",
            "route", "q.origen_nombre",
            "priority", "CASE q.prioridad WHEN 'HIGH' THEN 0 WHEN 'NORMAL' THEN 1 ELSE 2 END",
            "freight", "q.estado_flete",
            "requestDate", "q.fecha_solicitud");

    private static final int MAX_SEARCH_WORDS = 5;

    private final JdbcTemplate jdbc;

    public TransferSearchJdbcAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * La regla de {@code TransferActionPolicy} en SQL. Los permisos y la sucursal de quien mira vienen del servidor (nunca
     * del cliente) y entran como literales: booleanos y un número.
     */
    static String awaits(Viewer viewer) {
        String origin = side(viewer, "q.sucursal_origen_id");
        String destination = side(viewer, "q.sucursal_destino_id");
        return "((q.estado = 'PENDING' AND " + viewer.manager() + " AND " + destination + ")"
                + " OR (q.estado = 'APPROVED_DEST' AND " + viewer.manager() + " AND " + origin + ")"
                + " OR (q.estado = 'PREPARING' AND " + viewer.operational() + " AND " + origin + ")"
                + " OR (q.estado = 'IN_TRANSIT' AND " + viewer.operational() + " AND " + destination + ")"
                + " OR (q.estado = 'WITH_ISSUE' AND " + viewer.manager() + " AND (" + origin + " OR " + destination + ")))";
    }

    private static String side(Viewer viewer, String column) {
        if (viewer.admin()) return "TRUE";
        if (viewer.branchId() == null) return "FALSE";
        return "(" + column + " = " + viewer.branchId().longValue() + ")";
    }

    /** Quien no es ADMIN ve solo los traslados de su sucursal (como origen o destino). */
    private static String scope(Viewer viewer) {
        if (viewer.admin()) return " WHERE 1 = 1";
        return " WHERE (" + side(viewer, "q.sucursal_origen_id") + " OR " + side(viewer, "q.sucursal_destino_id") + ")";
    }

    @Override
    @Transactional(readOnly = true)
    public Page search(Criteria criteria, PageParams page, String sortBy, boolean ascending) {
        List<Object> args = new ArrayList<>();
        String where = where(criteria, args);
        Long total = jdbc.queryForObject("SELECT COUNT(*)" + FROM + where, Long.class, args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(page.size());
        pageArgs.add((long) page.page() * page.size());
        String direction = ascending ? "ASC" : "DESC";
        String order = "route".equals(sortBy)
                ? " ORDER BY q.origen_nombre " + direction + " NULLS LAST, q.destino_nombre " + direction + " NULLS LAST, q.id " + direction
                : " ORDER BY " + SORTS.getOrDefault(sortBy, "q.id") + " " + direction + " NULLS LAST, q.id " + direction;
        List<Row> content = jdbc.query("SELECT q.*, " + awaits(criteria.viewer()) + " AS me_toca" + FROM + where + order + " LIMIT ? OFFSET ?",
                ROW, pageArgs.toArray());
        return new Page(content, total == null ? 0 : total);
    }

    @Override
    @Transactional(readOnly = true)
    public Summary summary(Viewer viewer) {
        return jdbc.queryForObject("SELECT COUNT(*) FILTER (WHERE " + OPEN + ") AS abiertos,"
                        + " COUNT(*) FILTER (WHERE " + awaits(viewer) + ") AS me_tocan,"
                        + " COALESCE(SUM(q.saldo_flete) FILTER (WHERE q.saldo_flete > 0), 0) AS deuda,"
                        + " COUNT(*) FILTER (WHERE q.saldo_flete > 0) AS con_deuda"
                        + FROM + scope(viewer),
                (rs, i) -> new Summary(rs.getLong("abiertos"), rs.getLong("me_tocan"), rs.getBigDecimal("deuda"), rs.getLong("con_deuda")));
    }

    private static String where(Criteria c, List<Object> args) {
        StringBuilder sql = new StringBuilder(scope(c.viewer()));
        String status = c.status() == null ? "open" : c.status();
        if (status.equals("open")) {
            sql.append(" AND ").append(OPEN);
        } else if (!status.equals("all")) {
            sql.append(" AND q.estado = ?");
            args.add(TransferStatus.valueOf(status).name());
        }
        Long own = c.viewer().branchId();
        if (own != null && "incoming".equals(c.direction())) {
            sql.append(" AND q.sucursal_destino_id = ?");
            args.add(own);
        } else if (own != null && "outgoing".equals(c.direction())) {
            sql.append(" AND q.sucursal_origen_id = ?");
            args.add(own);
        }
        if (c.priority() != null) {
            sql.append(" AND q.prioridad = ?");
            args.add(c.priority().name());
        }
        if (c.from() != null) {
            sql.append(" AND q.fecha_solicitud >= ?");
            args.add(java.sql.Timestamp.valueOf(c.from().atStartOfDay()));
        }
        if (c.to() != null) {
            // «Hasta» incluye el día completo.
            sql.append(" AND q.fecha_solicitud < ?");
            args.add(java.sql.Timestamp.valueOf(c.to().plusDays(1).atStartOfDay()));
        }
        if (c.originId() != null) {
            sql.append(" AND q.sucursal_origen_id = ?");
            args.add(c.originId());
        }
        if (c.destinationId() != null) {
            sql.append(" AND q.sucursal_destino_id = ?");
            args.add(c.destinationId());
        }
        if (c.productId() != null) {
            sql.append(" AND EXISTS (SELECT 1 FROM detalles_transferencia d WHERE d.transferencia_id = q.id AND d.producto_id = ?)");
            args.add(c.productId());
        }
        if (c.onlyMine()) {
            sql.append(" AND ").append(awaits(c.viewer()));
        }
        // Cada palabra, en el número, en las sucursales o en algún producto del traslado.
        for (String word : SqlText.words(c.text(), MAX_SEARCH_WORDS)) {
            String like = SqlText.containsPattern(word);
            sql.append(" AND (CAST(q.id AS TEXT) LIKE ? OR ")
                    .append(SqlText.plain("q.origen_nombre")).append(" LIKE ? OR ")
                    .append(SqlText.plain("q.destino_nombre")).append(" LIKE ? OR EXISTS (SELECT 1 FROM detalles_transferencia d")
                    .append(" LEFT JOIN producto p ON p.id = d.producto_id WHERE d.transferencia_id = q.id AND ")
                    .append(SqlText.plain("COALESCE(d.producto_nombre, p.nombre)")).append(" LIKE ?))");
            for (int i = 0; i < 4; i++) args.add(like);
        }
        return sql.toString();
    }

    private static final RowMapper<Row> ROW = (rs, i) -> new Row(
            rs.getLong("id"),
            TransferStatus.valueOf(rs.getString("estado")),
            rs.getString("prioridad") == null ? TransferPriority.NORMAL : TransferPriority.valueOf(rs.getString("prioridad")),
            rs.getLong("sucursal_origen_id"),
            rs.getString("origen_nombre"),
            rs.getLong("sucursal_destino_id"),
            rs.getString("destino_nombre"),
            rs.getString("primer_producto"),
            rs.getInt("cantidad_productos"),
            FreightPaymentStatus.valueOf(rs.getString("estado_flete")),
            rs.getBigDecimal("saldo_flete"),
            rs.getTimestamp("fecha_solicitud").toLocalDateTime(),
            rs.getBoolean("me_toca"));
}
