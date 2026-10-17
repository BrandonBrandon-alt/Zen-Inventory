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
import co.com.zenvory.inventario.shared.infrastructure.security.CurrentUser;
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
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        // Quién solicita y desde qué sucursal salen de la sesión; el servicio exige que la venta sea de esa sucursal.
        CreateReturnRequestCommand trusted = new CreateReturnRequestCommand(
                command.saleId(), current.resolveBranch(command.branchId()), current.id(), command.generalReason(), command.items());
        ReturnRequest request = useCase.createRequest(trusted);
        return ResponseEntity.status(HttpStatus.CREATED).body(ReturnRequestResponse.fromDomain(request));
    }

    @PostMapping("/{id}/approve")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER')")
    public ResponseEntity<Void> approve(@PathVariable Long id, @RequestParam String comment) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        current.requireBranch(useCase.getRequestById(id).getBranchId());
        useCase.approveRequest(id, current.id(), comment);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reject")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER')")
    public ResponseEntity<Void> reject(@PathVariable Long id, @RequestParam String reason) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        current.requireBranch(useCase.getRequestById(id).getBranchId());
        useCase.rejectRequest(id, current.id(), reason);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_SELLER', 'ROLE_OPERADOR_INVENTARIO')")
    public ResponseEntity<ReturnRequestResponse> getById(@PathVariable Long id) {
        ReturnRequest request = useCase.getRequestById(id);
        CurrentUser.resolve(userRepositoryPort).requireBranch(request.getBranchId());
        return ResponseEntity.ok(ReturnRequestResponse.fromDomain(request));
    }

    @GetMapping("/pending")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER')")
    public ResponseEntity<List<ReturnRequestResponse>> getPending(@RequestParam Long branchId) {
        CurrentUser.resolve(userRepositoryPort).requireBranch(branchId);
        List<ReturnRequest> pending = useCase.getPendingRequestsByBranch(branchId);
        return ResponseEntity.ok(pending.stream().map(ReturnRequestResponse::fromDomain).toList());
    }

    @GetMapping("/branch/{branchId}")
    @PreAuthorize("hasAnyAuthority('ROLE_ADMIN', 'ROLE_MANAGER', 'ROLE_SELLER', 'ROLE_OPERADOR_INVENTARIO')")
    public ResponseEntity<List<ReturnRequestResponse>> getByBranch(@PathVariable Long branchId) {
        CurrentUser.resolve(userRepositoryPort).requireBranch(branchId);
        List<ReturnRequest> requests = useCase.getRequestsByBranch(branchId);
        return ResponseEntity.ok(requests.stream().map(ReturnRequestResponse::fromDomain).toList());
    }

    @GetMapping
    @PreAuthorize("hasAuthority('ROLE_ADMIN')")
    public ResponseEntity<List<ReturnRequestResponse>> getAll() {
        List<ReturnRequest> requests = useCase.getAllRequests();
        return ResponseEntity.ok(requests.stream().map(ReturnRequestResponse::fromDomain).toList());
    }
}
