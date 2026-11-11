package co.com.zenvory.inventario.audit.infrastructure.adapter.out;

import co.com.zenvory.inventario.audit.application.port.out.CatalogChangePort;
import co.com.zenvory.inventario.audit.domain.model.CatalogChange;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.shared.infrastructure.persistence.SqlText;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;

/** {@code cambio_catalogo} con SQL directo; escribe en la transacción del cambio que audita. */
@Component
public class CatalogChangeJdbcAdapter implements CatalogChangePort {

    private static final int MAX_SEARCH_WORDS = 5;
    private static final int MAX_NAME = 255;

    private final JdbcTemplate jdbc;

    public CatalogChangeJdbcAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public void record(List<CatalogChange> changes) {
        jdbc.batchUpdate("""
                INSERT INTO cambio_catalogo (fecha, entidad, entidad_id, entidad_nombre, campo, valor_anterior, valor_nuevo,
                                             usuario_id, usuario_nombre)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, changes, changes.size(), (ps, c) -> {
            ps.setTimestamp(1, Timestamp.valueOf(c.date()));
            ps.setString(2, c.entity().name());
            ps.setLong(3, c.entityId());
            ps.setString(4, truncate(c.entityName()));
            ps.setString(5, truncate(c.field()));
            ps.setString(6, c.before());
            ps.setString(7, c.after());
            ps.setObject(8, c.userId());
            ps.setString(9, c.userName() == null ? null : truncate(c.userName()));
        });
    }

    @Override
    @Transactional(readOnly = true)
    public Page search(Criteria criteria, PageParams page) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" FROM cambio_catalogo c WHERE 1 = 1");
        if (criteria.entity() != null) {
            where.append(" AND c.entidad = ?");
            args.add(criteria.entity().name());
        }
        if (criteria.from() != null) {
            where.append(" AND c.fecha >= ?");
            args.add(Timestamp.valueOf(criteria.from().atStartOfDay()));
        }
        if (criteria.to() != null) {
            // «Hasta» incluye el día completo.
            where.append(" AND c.fecha < ?");
            args.add(Timestamp.valueOf(criteria.to().plusDays(1).atStartOfDay()));
        }
        // Cada palabra debe aparecer en algún campo («cemento precio»).
        for (String word : SqlText.words(criteria.text(), MAX_SEARCH_WORDS)) {
            String like = SqlText.containsPattern(word);
            where.append(" AND (")
                    .append(SqlText.plain("c.entidad_nombre")).append(" LIKE ? OR ")
                    .append(SqlText.plain("c.campo")).append(" LIKE ? OR ")
                    .append(SqlText.plain("c.valor_anterior")).append(" LIKE ? OR ")
                    .append(SqlText.plain("c.valor_nuevo")).append(" LIKE ? OR ")
                    .append(SqlText.plain("c.usuario_nombre")).append(" LIKE ?)");
            for (int i = 0; i < 5; i++) args.add(like);
        }

        Long total = jdbc.queryForObject("SELECT COUNT(*)" + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(page.size());
        pageArgs.add((long) page.page() * page.size());
        List<CatalogChange> content = jdbc.query(
                "SELECT c.*" + where + " ORDER BY c.fecha DESC, c.id DESC LIMIT ? OFFSET ?", ROW, pageArgs.toArray());
        return new Page(content, total == null ? 0 : total);
    }

    private static String truncate(String value) {
        return value.length() <= MAX_NAME ? value : value.substring(0, MAX_NAME);
    }

    private static final RowMapper<CatalogChange> ROW = (rs, i) -> new CatalogChange(
            rs.getLong("id"),
            rs.getTimestamp("fecha").toLocalDateTime(),
            ChangedEntity.valueOf(rs.getString("entidad")),
            rs.getLong("entidad_id"),
            rs.getString("entidad_nombre"),
            rs.getString("campo"),
            rs.getString("valor_anterior"),
            rs.getString("valor_nuevo"),
            rs.getObject("usuario_id", Long.class),
            rs.getString("usuario_nombre"));
}
