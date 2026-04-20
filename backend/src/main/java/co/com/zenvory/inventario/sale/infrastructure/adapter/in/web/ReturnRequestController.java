package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.sale.application.port.in.CreateReturnRequestCommand;
import co.com.zenvory.inventario.sale.application.port.in.ReturnRequestUseCase;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/returns")
public class ReturnRequestController {

    private final ReturnRequestUseCase useCase;
    private final UserRepositoryPort userRepositoryPort;

    public ReturnRequestController(ReturnRequestUseCase useCase, UserRepositoryPort userRepositoryPort) {
        this.useCase = useCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    @PostMapping
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_SELLER', 'ROLE_OPERADOR_INVENTARIO')")
    public ResponseEntity<ReturnRequestResponse> create(@Valid @RequestBody CreateReturnRequestCommand command) {
        ReturnRequest request = useCase.createRequest(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReturnRequestResponse.fromDomain(request));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER')")
    public ResponseEntity<Void> approve(@PathVariable Long id, @RequestParam String comment) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = userRepositoryPort.findByEmail(auth.getName()).orElseThrow();
        
        useCase.approveRequest(id, user.getId(), comment);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER')")
    public ResponseEntity<Void> reject(@PathVariable Long id, @RequestParam String reason) {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = userRepositoryPort.findByEmail(auth.getName()).orElseThrow();
        
        useCase.rejectRequest(id, user.getId(), reason);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_SELLER', 'ROLE_OPERADOR_INVENTARIO')")
    public ResponseEntity<ReturnRequestResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(ReturnRequestResponse.fromDomain(useCase.getRequestById(id)));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER')")
    public ResponseEntity<List<ReturnRequestResponse>> getPending(@RequestParam Long branchId) {
        List<ReturnRequest> pending = useCase.getPendingRequestsByBranch(branchId);
        return ResponseEntity.ok(pending.stream().map(ReturnRequestResponse::fromDomain).toList());
    }

    @GetMapping("/branch/{branchId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_SELLER', 'ROLE_OPERADOR_INVENTARIO')")
    public ResponseEntity<List<ReturnRequestResponse>> getByBranch(@PathVariable Long branchId) {
        List<ReturnRequest> requests = useCase.getRequestsByBranch(branchId);
        return ResponseEntity.ok(requests.stream().map(ReturnRequestResponse::fromDomain).toList());
    }
}
