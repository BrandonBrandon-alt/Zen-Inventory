package co.com.zenvory.inventario.inventory.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.inventory.application.port.out.MovementPage;
import co.com.zenvory.inventario.inventory.application.port.out.MovementRecord;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchPort;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * La auditoría de movimientos con SQL directo: filtra, ordena, pagina y suma en la base, y trae en la misma consulta
 * los nombres de producto, sucursal y responsable (antes el navegador descargaba todos los movimientos y los cruzaba).
 *
 * <p>Lee {@code producto}, {@code sucursal} y {@code usuario}, que son de otros módulos: la misma excepción deliberada
 * que el módulo de analítica, porque una búsqueda por nombre necesita esos JOIN.</p>
 */
@Component
public class MovementSearchJdbcAdapter implements MovementSearchPort {

    private static final String FROM = """
             FROM movimiento_inventario m
             LEFT JOIN producto p ON p.id = m.producto_id
             LEFT JOIN sucursal s ON s.id = m.sucursal_id
             LEFT JOIN usuario u ON u.id = m.usuario_id
            """;

    /** Campos por los que se puede ordenar: solo estos llegan al SQL (lo que manda el cliente nunca se concatena). */
    private static final Map<String, String> SORTS = Map.of(
            "date", "m.fecha",
            "branch", "s.nombre",
            "product", "p.nombre",
            "type", "m.tipo",
            "reason", "m.motivo",
            "quantity", "CASE WHEN m.tipo = 'INGRESO' THEN m.cantidad ELSE -m.cantidad END",
            "balance", "m.saldo_final",
            "responsible", "u.nombre",
            "document", "m.tipo_referencia");

    /** Texto comparable: minúsculas y sin tildes, igual que {@link #normalize} hace con lo que se busca. */
    private static final String PLAIN = "translate(lower(coalesce(%s, '')), 'áéíóúüñ', 'aeiouun')";

    private static final int MAX_SEARCH_WORDS = 5;

    private final JdbcTemplate jdbc;

    public MovementSearchJdbcAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public MovementPage search(MovementSearchCriteria criteria, int page, int size, String sortBy, boolean ascending) {
        List<Object> args = new ArrayList<>();
        String where = where(criteria, args);

        Totals totals = jdbc.queryForObject(
                "SELECT COUNT(*) AS total,"
                        + " COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.cantidad END), 0) AS entradas,"
                        + " COALESCE(SUM(CASE WHEN m.tipo = 'RETIRO' THEN m.cantidad END), 0) AS salidas"
                        + FROM + where,
                (rs, i) -> new Totals(rs.getLong("total"), rs.getBigDecimal("entradas"), rs.getBigDecimal("salidas")),
                args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        List<MovementRecord> content = jdbc.query(select() + FROM + where + orderBy(sortBy, ascending) + " LIMIT ? OFFSET ?", ROW, pageArgs.toArray());

        return new MovementPage(content, totals.count(), totals.in(), totals.out());
    }

    @Override
    public List<MovementRecord> findAll(MovementSearchCriteria criteria, String sortBy, boolean ascending, int limit) {
        List<Object> args = new ArrayList<>();
        String where = where(criteria, args);
        args.add(limit);
        return jdbc.query(select() + FROM + where + orderBy(sortBy, ascending) + " LIMIT ?", ROW, args.toArray());
    }

    private static String select() {
        return "SELECT m.id, m.tipo, m.motivo, m.sub_motivo, m.cantidad, m.fecha, m.producto_id, m.sucursal_id, m.usuario_id,"
                + " m.referencia_id, m.tipo_referencia, m.observaciones, m.saldo_final,"
                + " p.nombre AS producto_nombre, s.nombre AS sucursal_nombre, u.nombre AS usuario_nombre";
    }

    private static String where(MovementSearchCriteria c, List<Object> args) {
        StringBuilder sql = new StringBuilder(" WHERE 1 = 1");
        if (c.branchId() != null) {
            sql.append(" AND m.sucursal_id = ?");
            args.add(c.branchId());
        }
        if (c.type() != null) {
            sql.append(" AND m.tipo = ?");
            args.add(c.type().name());
        }
        if (c.reason() != null) {
            sql.append(" AND m.motivo = ?");
            args.add(c.reason().name());
        }
        if (c.from() != null) {
            sql.append(" AND m.fecha >= ?");
            args.add(Timestamp.valueOf(c.from().atStartOfDay()));
        }
        if (c.to() != null) {
            // "Hasta" incluye el día completo.
            sql.append(" AND m.fecha < ?");
            args.add(Timestamp.valueOf(c.to().plusDays(1).atStartOfDay()));
        }
        if (c.productId() != null) {
            sql.append(" AND m.producto_id = ?");
            args.add(c.productId());
        }
        if (c.userId() != null) {
            sql.append(" AND m.usuario_id = ?");
            args.add(c.userId());
        }
        if (c.minQuantity() != null) {
            sql.append(" AND m.cantidad >= ?");
            args.add(c.minQuantity());
        }
        if (c.maxQuantity() != null) {
            sql.append(" AND m.cantidad <= ?");
            args.add(c.maxQuantity());
        }
        if (c.onlyObserved()) {
            sql.append(" AND NULLIF(TRIM(m.observaciones), '') IS NOT NULL");
        }
        // Cada palabra debe aparecer en algún campo («compra 41» = de una compra y con el número 41).
        for (String word : words(c.text())) {
            String like = "%" + escapeLike(word) + "%";
            sql.append(" AND (")
                    .append(PLAIN.formatted("p.nombre")).append(" LIKE ? OR ")
                    .append(PLAIN.formatted("p.sku")).append(" LIKE ? OR ")
                    .append(PLAIN.formatted("u.nombre")).append(" LIKE ? OR ")
                    .append(PLAIN.formatted("m.observaciones")).append(" LIKE ? OR ")
                    .append(PLAIN.formatted("m.tipo_referencia")).append(" LIKE ? OR ")
                    .append(PLAIN.formatted("m.motivo")).append(" LIKE ? OR ")
                    .append("CAST(m.id AS TEXT) = ? OR CAST(m.referencia_id AS TEXT) = ?)");
            for (int i = 0; i < 6; i++) args.add(like);
            args.add(word);
            args.add(word);
        }
        return sql.toString();
    }

    private static String orderBy(String sortBy, boolean ascending) {
        String column = SORTS.getOrDefault(sortBy, "m.fecha");
        String direction = ascending ? "ASC" : "DESC";
        return " ORDER BY " + column + " " + direction + " NULLS LAST, m.id " + direction;
    }

    /** Las palabras buscadas, normalizadas; «#41» se busca como 41. */
    static List<String> words(String text) {
        if (text == null || text.isBlank()) return List.of();
        return Arrays.stream(normalize(text).split("\\s+"))
                .map(word -> word.replace("#", ""))
                .filter(word -> !word.isEmpty())
                .limit(MAX_SEARCH_WORDS)
                .toList();
    }

    static String normalize(String text) {
        return Normalizer.normalize(text.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static String escapeLike(String word) {
        return word.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static final RowMapper<MovementRecord> ROW = (rs, i) -> {
        Timestamp date = rs.getTimestamp("fecha");
        InventoryMovement movement = InventoryMovement.builder()
                .id(rs.getLong("id"))
                .type(MovementType.valueOf(rs.getString("tipo")))
                .reason(MovementReason.valueOf(rs.getString("motivo")))
                .subReason(rs.getString("sub_motivo"))
                .quantity(rs.getBigDecimal("cantidad"))
                .date(date == null ? null : date.toLocalDateTime())
                .productId(rs.getLong("producto_id"))
                .branchId(rs.getLong("sucursal_id"))
                .userId((Long) rs.getObject("usuario_id", Long.class))
                .referenceId((Long) rs.getObject("referencia_id", Long.class))
                .referenceType(rs.getString("tipo_referencia"))
                .observations(rs.getString("observaciones"))
                .finalBalance(rs.getBigDecimal("saldo_final"))
                .build();
        return new MovementRecord(movement, rs.getString("producto_nombre"), rs.getString("sucursal_nombre"), rs.getString("usuario_nombre"));
    };

    private record Totals(long count, BigDecimal in, BigDecimal out) {
    }
}
