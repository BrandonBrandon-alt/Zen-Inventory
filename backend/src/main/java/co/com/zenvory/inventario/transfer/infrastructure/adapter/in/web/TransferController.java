package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.transfer.application.port.in.DispatchTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.ReceiveTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import co.com.zenvory.inventario.shared.infrastructure.web.ResolutionRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import co.com.zenvory.inventario.shared.infrastructure.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;

@RestController
@RequestMapping("/api/v1/transfers")
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
public class TransferController {

    private final TransferUseCase transferUseCase;
    private final UserRepositoryPort userRepositoryPort;

    public TransferController(TransferUseCase transferUseCase, UserRepositoryPort userRepositoryPort) {
        this.transferUseCase = transferUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    @PostMapping
    public ResponseEntity<TransferResponse> requestTransfer(@Valid @RequestBody TransferRequest request) {
        RequestTransferCommand command = new RequestTransferCommand(
                request.originBranchId(),
                request.destinationBranchId(),
                request.estimatedArrivalDate(),
                request.priority() != null ? co.com.zenvory.inventario.transfer.domain.model.TransferPriority.valueOf(request.priority().toUpperCase()) : co.com.zenvory.inventario.transfer.domain.model.TransferPriority.NORMAL,
                request.items().stream()
                        .map(item -> new RequestTransferCommand.Detail(item.productId(), item.requestedQuantity()))
                        .toList()
        );

        Transfer transfer = transferUseCase.requestTransfer(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/approve-destination")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TransferResponse> approveDestination(@PathVariable Long id) {
        Transfer transfer = transferUseCase.approveDestination(id);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<TransferResponse> dispatchTransfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferDispatchRequest request) {
        
        DispatchTransferCommand command = new DispatchTransferCommand(
                request.carrier(),
                request.shippingCost() != null ? request.shippingCost() : java.math.BigDecimal.ZERO,
                request.trackingNumber(),
                request.estimatedArrivalDate(),
                request.items().stream()
                        .map(item -> new DispatchTransferCommand.DispatchDetail(item.detailId(), item.sentQuantity()))
                        .toList()
        );

        Transfer transfer = transferUseCase.dispatchTransfer(id, command);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/prepare")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TransferResponse> prepareTransfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferPrepareRequest request) {
        
        java.util.List<co.com.zenvory.inventario.transfer.application.port.in.UpdateQuantityCommand> items = request.items().stream()
                .map(item -> new co.com.zenvory.inventario.transfer.application.port.in.UpdateQuantityCommand(item.productId(), item.requestedQuantity()))
                .toList();

        Transfer transfer = transferUseCase.prepareTransfer(id, items);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<TransferResponse> receiveTransfer(
            @PathVariable Long id,
            @Valid @RequestBody TransferReceiveRequest request) {
        
        ReceiveTransferCommand command = new ReceiveTransferCommand(
                request.notes(),
                request.items().stream()
                        .map(item -> new ReceiveTransferCommand.ReceivedDetail(item.detailId(), item.receivedQuantity()))
                        .toList()
        );

        Transfer transfer = transferUseCase.receiveTransfer(id, command);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/resolve-shrinkage")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> resolveAsShrinkage(@PathVariable Long id) {
        transferUseCase.resolveAsShrinkage(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/resolve-resend")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> resolveAsResend(@PathVariable Long id) {
        transferUseCase.resolveAsResend(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/resolve-claim")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> resolveAsClaim(@PathVariable Long id) {
        transferUseCase.resolveAsClaim(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/{id}/pay-freight")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TransferResponse> payFreight(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) FreightPaymentRequest request) {
        FreightPaymentRequest pay = request != null ? request : new FreightPaymentRequest(null, null, null, null);
        Transfer transfer = transferUseCase.registerFreightPayment(id, pay.amount(), pay.method(), pay.reference(), pay.notes());
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @PostMapping("/{id}/cancel")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> cancelTransfer(
            @PathVariable Long id,
            @Valid @RequestBody ResolutionRequest request) {
        transferUseCase.cancelTransfer(id, request.reason());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/reject")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> rejectTransfer(
            @PathVariable Long id,
            @Valid @RequestBody ResolutionRequest request) {
        transferUseCase.rejectTransfer(id, request.reason());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public ResponseEntity<TransferResponse> getTransfer(@PathVariable Long id) {
        Transfer transfer = transferUseCase.getTransferForCurrentUser(id);
        return ResponseEntity.ok(TransferResponse.fromDomain(transfer));
    }

    @GetMapping
    public ResponseEntity<java.util.List<TransferResponse>> getAllTransfers() {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);

        java.util.List<Transfer> transfers;
        if (current.isAdmin()) {
            transfers = transferUseCase.getAllTransfers();
        } else {
            transfers = transferUseCase.getTransfersByBranch(current.resolveBranch(null));
        }
        
        return ResponseEntity.ok(transfers.stream()
                .map(TransferResponse::fromDomain)
                .toList());
    }

    @GetMapping("/fulfillment-report")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<TransferFulfillmentReport> getFulfillmentReport() {
        return ResponseEntity.ok(transferUseCase.getFulfillmentReport(reportScope()));
    }

    @GetMapping("/analytics/logistics")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<LogisticsAnalyticsResponse> getLogisticsAnalytics() {
        return ResponseEntity.ok(transferUseCase.getLogisticsAnalytics(reportScope()));
    }

    /** Los informes cubren todas las sucursales solo para el ADMIN; el resto ve únicamente la suya. */
    private Long reportScope() {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        return current.isAdmin() ? null : current.resolveBranch(null);
    }
}
