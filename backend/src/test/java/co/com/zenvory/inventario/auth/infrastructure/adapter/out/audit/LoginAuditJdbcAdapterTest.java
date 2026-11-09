package co.com.zenvory.inventario.auth.infrastructure.adapter.out.audit;

import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;
import co.com.zenvory.inventario.auth.domain.model.LoginEvent;
import co.com.zenvory.inventario.auth.domain.model.LoginOutcome;
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

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Auditoría de inicios de sesión contra un PostgreSQL real con las migraciones (usuarios 1-3 del seed V2). */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(LoginAuditJdbcAdapter.class)
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("LoginAuditJdbcAdapter — inicios de sesión")
class LoginAuditJdbcAdapterTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private LoginAuditJdbcAdapter adapter;

    @Autowired
    private JdbcTemplate jdbc;

    private static final LoginAuditPort.Criteria ALL = new LoginAuditPort.Criteria(null, null, null, null);

    @BeforeEach
    void clean() {
        jdbc.update("DELETE FROM inicio_sesion");
    }

    @Test
    @DisplayName("registra cada intento y los devuelve del más reciente al más antiguo, con el nombre de la persona")
    void recordsAndListsNewestFirst() {
        adapter.record("admin@zeninventory.co", 1L, LoginOutcome.EXITOSO, "181.50.1.2");
        adapter.record("nadie@x.co", null, LoginOutcome.CREDENCIALES_INVALIDAS, null);

        LoginAuditPort.Page page = adapter.search(ALL, 0, 25);

        assertThat(page.totalElements()).isEqualTo(2);
        assertThat(page.failures()).isEqualTo(1);
        LoginEvent newest = page.content().get(0);
        assertThat(newest.email()).isEqualTo("nadie@x.co");
        assertThat(newest.userId()).isNull();
        assertThat(newest.userName()).isNull();
        LoginEvent success = page.content().get(1);
        assertThat(success.userName()).isEqualTo("Administrador Principal");
        assertThat(success.ip()).isEqualTo("181.50.1.2");
        assertThat(success.outcome()).isEqualTo(LoginOutcome.EXITOSO);
    }

    @Test
    @DisplayName("filtra por resultado, por texto (correo o nombre, sin tildes) y por fecha")
    void filters() {
        adapter.record("admin@zeninventory.co", 1L, LoginOutcome.EXITOSO, null);
        adapter.record("gerente@zeninventory.co", 2L, LoginOutcome.BLOQUEADO, null);
        adapter.record("otro@x.co", null, LoginOutcome.CREDENCIALES_INVALIDAS, null);

        assertThat(emails(new LoginAuditPort.Criteria(null, null, LoginOutcome.BLOQUEADO, null))).containsExactly("gerente@zeninventory.co");
        assertThat(emails(new LoginAuditPort.Criteria(null, null, null, "GERÉNTE"))).containsExactly("gerente@zeninventory.co");
        assertThat(emails(new LoginAuditPort.Criteria(null, null, null, "principal"))).containsExactly("admin@zeninventory.co");
        LocalDate today = jdbc.queryForObject("SELECT CURRENT_DATE", LocalDate.class);
        assertThat(emails(new LoginAuditPort.Criteria(today.plusDays(1), null, null, null))).isEmpty();
        assertThat(emails(new LoginAuditPort.Criteria(today, today, null, null))).hasSize(3);
    }

    @Test
    @DisplayName("pagina en la base y recorta un correo o una IP demasiado largos en vez de fallar")
    void paginatesAndTruncates() {
        for (int i = 0; i < 5; i++) adapter.record("u" + i + "@x.co", null, LoginOutcome.CREDENCIALES_INVALIDAS, "x".repeat(200));
        LoginAuditPort.Page second = adapter.search(ALL, 1, 2);
        assertThat(second.content()).hasSize(2);
        assertThat(second.totalElements()).isEqualTo(5);
        assertThat(second.content().get(0).ip()).hasSize(64);
    }

    private List<String> emails(LoginAuditPort.Criteria criteria) {
        return adapter.search(criteria, 0, 25).content().stream().map(LoginEvent::email).toList();
    }
}
