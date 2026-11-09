package co.com.zenvory.inventario.auth.infrastructure.adapter.out.audit;

import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;
import co.com.zenvory.inventario.auth.domain.model.LoginEvent;
import co.com.zenvory.inventario.auth.domain.model.LoginOutcome;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.sql.Timestamp;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Auditoría de inicios de sesión con SQL directo sobre {@code inicio_sesion}. */
@Component
public class LoginAuditJdbcAdapter implements LoginAuditPort {

    private static final String FROM = " FROM inicio_sesion e LEFT JOIN usuario u ON u.id = e.usuario_id";
    /** Texto comparable: minúsculas y sin tildes. */
    private static final String PLAIN = "translate(lower(coalesce(%s, '')), 'áéíóúüñ', 'aeiouun')";
    private static final int MAX_EMAIL = 255;
    private static final int MAX_IP = 64;

    private final JdbcTemplate jdbc;

    public LoginAuditJdbcAdapter(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /**
     * En su propia transacción: un inicio de sesión fallido termina en excepción, y el registro del intento no debe
     * deshacerse con ella.
     */
    @Override
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void record(String email, Long userId, LoginOutcome outcome, String ip) {
        jdbc.update("INSERT INTO inicio_sesion (email, usuario_id, resultado, ip) VALUES (?, ?, ?, ?)",
                truncate(email == null ? "" : email, MAX_EMAIL), userId, outcome.name(), ip == null ? null : truncate(ip, MAX_IP));
    }

    @Override
    @Transactional(readOnly = true)
    public Page search(Criteria criteria, int page, int size) {
        List<Object> args = new ArrayList<>();
        StringBuilder where = new StringBuilder(" WHERE 1 = 1");
        if (criteria.from() != null) {
            where.append(" AND e.fecha >= ?");
            args.add(Timestamp.valueOf(criteria.from().atStartOfDay()));
        }
        if (criteria.to() != null) {
            where.append(" AND e.fecha < ?");
            args.add(Timestamp.valueOf(criteria.to().plusDays(1).atStartOfDay()));
        }
        if (criteria.outcome() != null) {
            where.append(" AND e.resultado = ?");
            args.add(criteria.outcome().name());
        }
        if (criteria.text() != null && !criteria.text().isBlank()) {
            String like = "%" + escapeLike(normalize(criteria.text())) + "%";
            where.append(" AND (").append(PLAIN.formatted("e.email")).append(" LIKE ? OR ").append(PLAIN.formatted("u.nombre")).append(" LIKE ?)");
            args.add(like);
            args.add(like);
        }

        long[] totals = jdbc.queryForObject("SELECT COUNT(*), COUNT(*) FILTER (WHERE e.resultado <> 'EXITOSO')" + FROM + where,
                (rs, i) -> new long[] {rs.getLong(1), rs.getLong(2)}, args.toArray());

        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(size);
        pageArgs.add((long) page * size);
        List<LoginEvent> content = jdbc.query(
                "SELECT e.id, e.fecha, e.email, e.usuario_id, u.nombre AS usuario_nombre, e.resultado, e.ip" + FROM + where
                        + " ORDER BY e.fecha DESC, e.id DESC LIMIT ? OFFSET ?",
                ROW, pageArgs.toArray());
        return new Page(content, totals[0], totals[1]);
    }

    private static String truncate(String value, int max) {
        String trimmed = value.trim();
        return trimmed.length() <= max ? trimmed : trimmed.substring(0, max);
    }

    private static String normalize(String text) {
        return Normalizer.normalize(text.trim().toLowerCase(Locale.ROOT), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }

    private static final RowMapper<LoginEvent> ROW = (rs, i) -> new LoginEvent(
            rs.getLong("id"),
            rs.getTimestamp("fecha").toLocalDateTime(),
            rs.getString("email"),
            rs.getObject("usuario_id", Long.class),
            rs.getString("usuario_nombre"),
            LoginOutcome.valueOf(rs.getString("resultado")),
            rs.getString("ip"));
}
