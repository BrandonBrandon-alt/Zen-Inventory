package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.LoginAuditUseCase;
import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.LoginEvent;
import co.com.zenvory.inventario.auth.domain.model.LoginOutcome;
import co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence.JpaUserRepository;
import co.com.zenvory.inventario.shared.infrastructure.security.JwtService;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LoginAuditController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("LoginAuditController — auditoría de inicios de sesión")
class LoginAuditControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private LoginAuditUseCase audit;

    @MockitoBean
    private UserRepositoryPort userRepositoryPort;

    @MockitoBean
    private JpaUserRepository jpaUserRepository;

    @MockitoBean
    private JwtService jwtService;

    @Test
    @DisplayName("pasa los filtros y devuelve la página con el total de fallidos")
    void search() throws Exception {
        when(audit.search(any(), anyInt(), anyInt())).thenReturn(new LoginAuditPort.Page(
                List.of(new LoginEvent(3L, LocalDateTime.of(2026, 11, 8, 21, 0), "ana@x.co", 7L, "Ana", LoginOutcome.BLOQUEADO, "1.2.3.4")), 30, 12));

        mockMvc.perform(get("/api/v1/audit/logins?page=1&size=25&from=2026-11-01&to=2026-11-08&outcome=BLOQUEADO").param("q", " ana "))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content[0].email").value("ana@x.co"))
                .andExpect(jsonPath("$.content[0].outcome").value("BLOQUEADO"))
                .andExpect(jsonPath("$.content[0].ip").value("1.2.3.4"))
                .andExpect(jsonPath("$.totalPages").value(2))
                .andExpect(jsonPath("$.failures").value(12));
        verify(audit).search(new LoginAuditPort.Criteria(LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 8), LoginOutcome.BLOQUEADO, "ana"), 1, 25);
    }

    @Test
    @DisplayName("solo el ADMIN consulta los inicios de sesión")
    void adminOnly() throws Exception {
        PreAuthorize rule = LoginAuditController.class.getMethod("search", int.class, int.class, LocalDate.class, LocalDate.class, LoginOutcome.class, String.class)
                .getAnnotation(PreAuthorize.class);
        assertThat(rule.value()).isEqualTo("hasRole('ADMIN')");
    }
}
