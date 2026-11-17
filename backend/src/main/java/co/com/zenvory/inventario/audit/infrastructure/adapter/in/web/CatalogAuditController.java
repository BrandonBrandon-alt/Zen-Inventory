package co.com.zenvory.inventario.audit.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.audit.application.port.in.CatalogAuditUseCase;
import co.com.zenvory.inventario.audit.application.port.out.CatalogChangePort;
import co.com.zenvory.inventario.audit.domain.model.CatalogChange;
import co.com.zenvory.inventario.audit.domain.model.ChangedEntity;
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

/** Cambios de productos y usuarios (Auditoría Global, pestaña «Cambios del catálogo»). Solo ADMIN. */
@RestController
@RequestMapping("/api/v1/audit/catalog-changes")
public class CatalogAuditController {

    private final CatalogAuditUseCase audit;

    public CatalogAuditController(CatalogAuditUseCase audit) {
        this.audit = audit;
    }

    public record CatalogChangeResponse(Long id, LocalDateTime date, ChangedEntity entity, Long entityId, String entityName,
                                        String field, String before, String after, String userName) {
        static CatalogChangeResponse from(CatalogChange c) {
            return new CatalogChangeResponse(c.id(), c.date(), c.entity(), c.entityId(), c.entityName(), c.field(), c.before(), c.after(), c.userName());
        }
    }

    public record CatalogChangePageResponse(List<CatalogChangeResponse> content, long totalElements, int page, int size, int totalPages) {
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<CatalogChangePageResponse> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(required = false) ChangedEntity entity,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false, name = "q") String text) {
        PageParams paging = PageParams.of(page, size);
        CatalogChangePort.Page result = audit.search(
                new CatalogChangePort.Criteria(entity, from, to, text == null || text.isBlank() ? null : text.trim()), paging);
        return ResponseEntity.ok(new CatalogChangePageResponse(
                result.content().stream().map(CatalogChangeResponse::from).toList(),
                result.totalElements(), paging.page(), paging.size(), paging.totalPages(result.totalElements())));
    }
}
