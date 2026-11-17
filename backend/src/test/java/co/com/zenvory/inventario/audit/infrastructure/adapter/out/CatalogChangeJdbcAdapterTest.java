package co.com.zenvory.inventario.audit.infrastructure.adapter.out;

import co.com.zenvory.inventario.audit.application.port.out.CatalogChangePort;
import co.com.zenvory.inventario.audit.domain.model.CatalogChange;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
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
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/** Registro y consulta de {@code cambio_catalogo} contra un PostgreSQL real con las migraciones. Sin Docker se omite. */
@JdbcTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import(CatalogChangeJdbcAdapter.class)
@Testcontainers(disabledWithoutDocker = true)
@DisplayName("CatalogChangeJdbcAdapter — cambios del catálogo en la base")
class CatalogChangeJdbcAdapterTest {

    @Container
    @ServiceConnection
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:16-alpine");

    @Autowired
    private CatalogChangeJdbcAdapter adapter;

    @Autowired
    private JdbcTemplate jdbc;

    private static final CatalogChangePort.Criteria ALL = new CatalogChangePort.Criteria(null, null, null, null);

    @BeforeEach
    void seed() {
        jdbc.update("DELETE FROM cambio_catalogo");
        adapter.record(List.of(
                change(LocalDateTime.of(2026, 10, 12, 9, 0), ChangedEntity.PRODUCTO, 1L, "Cemento Gris 50Kg", "Precio de venta", "$ 34.000", "$ 36.000", 1L, "Admin General"),
                change(LocalDateTime.of(2026, 10, 13, 23, 30), ChangedEntity.USUARIO, 2L, "Ana Ruiz", "Rol", "Vendedor", "Gerente", 1L, "Admin General")));
        adapter.record(List.of(
                change(LocalDateTime.of(2026, 10, 14, 8, 0), ChangedEntity.PRODUCTO, 3L, "Varilla", "Estado", "Activo", "Inactivo", 2L, "José Peña")));
    }

    private static CatalogChange change(LocalDateTime date, ChangedEntity entity, Long id, String name, String field,
                                        String before, String after, Long userId, String userName) {
        return new CatalogChange(null, date, entity, id, name, field, before, after, userId, userName);
    }

    @Test
    @DisplayName("registra todo lo que se le pasa y lista del más reciente al más antiguo")
    void registraYListaDelMasReciente() {
        CatalogChangePort.Page page = adapter.search(ALL, new PageParams(0, 25));

        assertThat(page.totalElements()).isEqualTo(3);
        assertThat(page.content()).extracting(CatalogChange::entityName).containsExactly("Varilla", "Ana Ruiz", "Cemento Gris 50Kg");
        CatalogChange first = page.content().get(0);
        assertThat(first.id()).isNotNull();
        assertThat(first).usingRecursiveComparison().ignoringFields("id")
                .isEqualTo(change(LocalDateTime.of(2026, 10, 14, 8, 0), ChangedEntity.PRODUCTO, 3L, "Varilla", "Estado", "Activo", "Inactivo", 2L, "José Peña"));
    }

    @Test
    @DisplayName("filtra por entidad, fechas (el día «Hasta» completo) y texto sin tildes en lo cambiado o en quién")
    void filtraPorEntidadFechaYTexto() {
        assertThat(names(new CatalogChangePort.Criteria(ChangedEntity.USUARIO, null, null, null))).containsExactly("Ana Ruiz");
        assertThat(names(new CatalogChangePort.Criteria(null, LocalDate.of(2026, 10, 12), LocalDate.of(2026, 10, 13), null)))
                .containsExactly("Ana Ruiz", "Cemento Gris 50Kg");
        assertThat(names(new CatalogChangePort.Criteria(null, null, null, "jose"))).containsExactly("Varilla");
        assertThat(names(new CatalogChangePort.Criteria(null, null, null, "CEMENTO precio"))).containsExactly("Cemento Gris 50Kg");
        assertThat(names(new CatalogChangePort.Criteria(null, null, null, "100%"))).isEmpty();
    }

    @Test
    @DisplayName("pagina en la base y el total abarca todo")
    void pagina() {
        CatalogChangePort.Page second = adapter.search(ALL, new PageParams(1, 2));

        assertThat(second.content()).extracting(CatalogChange::entityName).containsExactly("Cemento Gris 50Kg");
        assertThat(second.totalElements()).isEqualTo(3);
    }

    private List<String> names(CatalogChangePort.Criteria criteria) {
        return adapter.search(criteria, new PageParams(0, 25)).content().stream().map(CatalogChange::entityName).toList();
    }
}
