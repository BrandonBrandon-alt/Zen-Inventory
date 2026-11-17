package co.com.zenvory.inventario.shared.infrastructure.persistence;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;

/**
 * Toda migración debe poder correr otra vez sobre un esquema que ya tiene sus cambios sin fallar ni perder datos. En
 * producción (Neon) el historial de Flyway quedó en V8 con las columnas de V9 ya creadas y el arranque se caía con
 * «column anulado_en already exists». Cada migración corre además en su propia transacción (Flyway en PostgreSQL), así
 * que si una falla no deja nada a medias. Sin Docker la clase se omite.
 */
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("Migraciones — cada una se puede repetir sin fallar ni perder datos")
class MigrationRerunTest {

    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    private static JdbcTemplate jdbc() {
        return new JdbcTemplate(new DriverManagerDataSource(postgres.getJdbcUrl(), postgres.getUsername(), postgres.getPassword()));
    }

    /** V1, V2, … V11 en orden de versión (no alfabético: V10 va después de V9). */
    private static List<Resource> migrations() throws Exception {
        Resource[] found = new PathMatchingResourcePatternResolver().getResources("classpath:db/migration/V*__*.sql");
        return Arrays.stream(found)
                .sorted(Comparator.comparingInt(r -> Integer.parseInt(r.getFilename().substring(1, r.getFilename().indexOf("__")))))
                .toList();
    }

    private static void run(JdbcTemplate jdbc, Resource script) throws Exception {
        jdbc.execute(script.getContentAsString(StandardCharsets.UTF_8));
    }

    @Test
    @DisplayName("cada migración corre dos veces seguidas, y repetir el esquema inicial con datos no borra nada")
    void cadaMigracionSePuedeRepetir() throws Exception {
        JdbcTemplate jdbc = jdbc();
        List<Resource> scripts = migrations();
        assertThat(scripts).hasSizeGreaterThanOrEqualTo(11);
        for (Resource script : scripts) {
            assertThatCode(() -> run(jdbc, script)).as("primera vez " + script.getFilename()).doesNotThrowAnyException();
            assertThatCode(() -> run(jdbc, script)).as("otra vez " + script.getFilename()).doesNotThrowAnyException();
            if (script.getFilename().startsWith("V2__")) {
                // Ya hay datos: repetir el esquema inicial no debe borrarlos.
                Integer before = jdbc.queryForObject("SELECT COUNT(*) FROM usuario", Integer.class);
                run(jdbc, new ClassPathResource("db/migration/V1__Initial_Schema.sql"));
                assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM usuario", Integer.class)).as("usuarios tras repetir V1").isEqualTo(before).isPositive();
            }
        }
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM alertas_stock", Integer.class)).as("alertas de ejemplo sin duplicar").isEqualTo(2);
        assertThat(jdbc.queryForObject("SELECT COUNT(*) FROM pg_constraint WHERE conname LIKE 'pagos_%_anula%'", Integer.class)).isEqualTo(4);
    }

    @Test
    @DisplayName("ninguna migración abre ni confirma su propia transacción (cortaría la de Flyway y dejaría cambios a medias)")
    void sinTransaccionesPropias() throws Exception {
        java.util.regex.Pattern own = java.util.regex.Pattern.compile("(?im)^\\s*(BEGIN|COMMIT|END|ROLLBACK)\\s*;");
        for (Resource script : migrations()) {
            assertThat(own.matcher(script.getContentAsString(StandardCharsets.UTF_8)).find()).as(script.getFilename()).isFalse();
        }
    }
}
