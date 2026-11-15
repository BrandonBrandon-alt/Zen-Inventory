package co.com.zenvory.inventario.audit.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.audit.application.port.in.CatalogAuditUseCase;
import co.com.zenvory.inventario.audit.application.port.out.CatalogChangePort;
import co.com.zenvory.inventario.audit.domain.model.CatalogChange;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CatalogAuditController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("CatalogAuditController — cambios del catálogo")
class CatalogAuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private CatalogAuditUseCase audit;

    @MockitoBean
    private UserRepositoryPort userRepositoryPort;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    @Test
    @DisplayName("pasa los filtros y devuelve la página")
    void pasaFiltrosYDevuelveLaPagina() throws Exception {
        when(audit.search(any(), any())).thenReturn(new CatalogChangePort.Page(List.of(new CatalogChange(4L, LocalDateTime.of(2026, 11, 8, 9, 0),
                ChangedEntity.PRODUCTO, 1L, "Cemento Gris 50Kg", "Precio de venta", "$ 34.000", "$ 36.000", 2L, "Ana Ruiz")), 30));

        mockMvc.perform(get("/api/v1/audit/catalog-changes?page=1&size=25&entity=PRODUCTO&from=2026-11-01&to=2026-11-08").param("q", " cemento "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].entity").value("PRODUCTO"))
                .andExpect(jsonPath("$.content[0].entityName").value("Cemento Gris 50Kg"))
                .andExpect(jsonPath("$.content[0].field").value("Precio de venta"))
                .andExpect(jsonPath("$.content[0].before").value("$ 34.000"))
                .andExpect(jsonPath("$.content[0].after").value("$ 36.000"))
                .andExpect(jsonPath("$.content[0].userName").value("Ana Ruiz"))
                .andExpect(jsonPath("$.totalElements").value(30))
                .andExpect(jsonPath("$.totalPages").value(2));
        verify(audit).search(new CatalogChangePort.Criteria(ChangedEntity.PRODUCTO, LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 8), "cemento"),
                new PageParams(1, 25));
    }

    @Test
    @DisplayName("el tamaño de página tiene tope y sin texto no filtra")
    void topeYSinTexto() throws Exception {
        when(audit.search(any(), any())).thenReturn(new CatalogChangePort.Page(List.of(), 0));

        mockMvc.perform(get("/api/v1/audit/catalog-changes?size=5000").param("q", "  ")).andExpect(status().isOk());

        verify(audit).search(new CatalogChangePort.Criteria(null, null, null, null), new PageParams(0, PageParams.MAX_SIZE));
    }

    @Test
    @DisplayName("solo el ADMIN consulta los cambios del catálogo")
    void soloAdmin() throws Exception {
        PreAuthorize rule = CatalogAuditController.class.getMethod("search", int.class, int.class, ChangedEntity.class, LocalDate.class, LocalDate.class, String.class)
                .getAnnotation(PreAuthorize.class);
        assertThat(rule.value()).isEqualTo("hasRole('ADMIN')");
    }
}
