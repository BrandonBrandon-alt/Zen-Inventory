package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.LoginAuditUseCase;
import co.com.zenvory.inventario.auth.application.port.out.LoginAuditPort;
import co.com.zenvory.inventario.auth.domain.model.LoginEvent;
import co.com.zenvory.inventario.auth.domain.model.LoginOutcome;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/** Intentos de inicio de sesión para la Auditoría Global (solo ADMIN), del más reciente al más antiguo. */
@RestController
@RequestMapping("/api/v1/audit/logins")
public class LoginAuditController {

    private final LoginAuditUseCase audit;

    public LoginAuditController(LoginAuditUseCase audit) {
        this.audit = audit;
    }

    public record LoginEventResponse(Long id, LocalDateTime date, String email, Long userId, String userName, LoginOutcome outcome, String ip) {
        static LoginEventResponse from(LoginEvent e) {
            return new LoginEventResponse(e.id(), e.date(), e.email(), e.userId(), e.userName(), e.outcome(), e.ip());
        }
    }

    /** `failures` cuenta los intentos fallidos de todo lo filtrado, no solo de la página. */
    public record LoginEventPageResponse(List<LoginEventResponse> content, long totalElements, int page, int size, int totalPages, long failures) {
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<LoginEventPageResponse> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) LoginOutcome outcome,
            @RequestParam(required = false, name = "q") String text) {
        LoginAuditPort.Page result = audit.search(
                new LoginAuditPort.Criteria(from, to, outcome, text == null || text.isBlank() ? null : text.trim()), page, size);
        PageParams paging = PageParams.of(page, size);
        return ResponseEntity.ok(new LoginEventPageResponse(
                result.content().stream().map(LoginEventResponse::from).toList(),
                result.totalElements(), paging.page(), paging.size(), paging.totalPages(result.totalElements()), result.failures()));
    }
}
