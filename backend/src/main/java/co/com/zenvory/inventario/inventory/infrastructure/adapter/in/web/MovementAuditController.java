package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.inventory.application.port.in.MovementAuditUseCase;
import co.com.zenvory.inventario.inventory.application.port.out.MovementPage;
import co.com.zenvory.inventario.inventory.application.port.out.MovementSearchCriteria;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto.MovementAuditPageResponse;
import co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto.MovementAuditResponse;
import co.com.zenvory.inventario.shared.infrastructure.security.CurrentUser;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Auditoría de movimientos paginada en el servidor (pantalla Auditoría Global). La sucursal sigue la regla de
 * {@code GET /movements}: el ADMIN elige cualquiera o todas; el resto ve solo la suya, pida lo que pida.
 */
@RestController
@RequestMapping("/api/v1/inventory/movements")
public class MovementAuditController {

    private final MovementAuditUseCase audit;
    private final UserRepositoryPort users;

    public MovementAuditController(MovementAuditUseCase audit, UserRepositoryPort users) {
        this.audit = audit;
        this.users = users;
    }

    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<MovementAuditPageResponse> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) MovementReason reason,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) BigDecimal minQuantity,
            @RequestParam(required = false) BigDecimal maxQuantity,
            @RequestParam(defaultValue = "false") boolean onlyObserved,
            @RequestParam(required = false, name = "q") String text) {
        MovementSearchCriteria criteria = criteria(branchId, type, reason, from, to, productId, userId, minQuantity, maxQuantity, onlyObserved, text);
        MovementPage result = audit.search(criteria, page, size, sortBy, "asc".equalsIgnoreCase(direction));
        PageParams paging = PageParams.of(page, size);
        return ResponseEntity.ok(new MovementAuditPageResponse(
                result.content().stream().map(MovementAuditResponse::from).toList(),
                result.totalElements(), paging.page(), paging.size(), paging.totalPages(result.totalElements()),
                result.totalIn(), result.totalOut()));
    }

    /** Lo mismo que {@link #search} sin paginar (hasta 20.000 filas), para exportar a CSV. */
    @GetMapping("/export")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<MovementAuditResponse>> export(
            @RequestParam(defaultValue = "date") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) MovementType type,
            @RequestParam(required = false) MovementReason reason,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) Long userId,
            @RequestParam(required = false) BigDecimal minQuantity,
            @RequestParam(required = false) BigDecimal maxQuantity,
            @RequestParam(defaultValue = "false") boolean onlyObserved,
            @RequestParam(required = false, name = "q") String text) {
        MovementSearchCriteria criteria = criteria(branchId, type, reason, from, to, productId, userId, minQuantity, maxQuantity, onlyObserved, text);
        return ResponseEntity.ok(audit.export(criteria, sortBy, "asc".equalsIgnoreCase(direction)).stream().map(MovementAuditResponse::from).toList());
    }

    private MovementSearchCriteria criteria(Long branchId, MovementType type, MovementReason reason, LocalDate from, LocalDate to,
                                            Long productId, Long userId, BigDecimal minQuantity, BigDecimal maxQuantity,
                                            boolean onlyObserved, String text) {
        CurrentUser current = CurrentUser.resolve(users);
        Long branch = current.isAdmin() ? branchId : current.resolveBranch(null);
        return new MovementSearchCriteria(branch, type, reason, from, to, productId, userId, minQuantity, maxQuantity, onlyObserved,
                text == null || text.isBlank() ? null : text.trim());
    }
}
