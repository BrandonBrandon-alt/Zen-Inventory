package co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.transfer.application.port.in.DispatchTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.ReceiveTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import co.com.zenvory.inventario.transfer.application.port.out.TransferSearchPort;
import co.com.zenvory.inventario.transfer.domain.model.FreightPaymentStatus;
import co.com.zenvory.inventario.transfer.domain.model.TransferPriority;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;
import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.shared.infrastructure.security.Viewers;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.format.annotation.DateTimeFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
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

    /** Anula un pago del flete equivocado: queda en el historial marcado como anulado y deja de contar en lo pagado. */
    @PostMapping("/{id}/freight-payments/{paymentId}/void")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<TransferResponse> voidFreightPayment(
            @PathVariable Long id,
            @PathVariable Long paymentId,
            @Valid @RequestBody ResolutionRequest request) {
        return ResponseEntity.ok(TransferResponse.fromDomain(transferUseCase.voidFreightPayment(id, paymentId, request.reason())));
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

    public record TransferRowResponse(Long id, TransferStatus status, TransferPriority priority, Long originId, String originName,
                                      Long destinationId, String destinationName, String firstProductName, int productCount,
                                      FreightPaymentStatus freightStatus, BigDecimal freightBalance, LocalDateTime requestDate,
                                      boolean awaitsMe) {
        static TransferRowResponse from(TransferSearchPort.Row r) {
            return new TransferRowResponse(r.id(), r.status(), r.priority(), r.originId(), r.originName(), r.destinationId(), r.destinationName(),
                    r.firstProductName(), r.productCount(), r.freightStatus(), r.freightBalance(), r.requestDate(), r.awaitsMe());
        }
    }

    public record TransferPageResponse(java.util.List<TransferRowResponse> content, long totalElements, int page, int size, int totalPages) {
    }

    public record TransferSummaryResponse(long open, long awaitingMe, BigDecimal freightOwed, long freightOwedCount) {
    }

    /**
     * La lista de la pantalla de traslados, paginada en el servidor. Quien no es ADMIN ve solo los de su sucursal (como
     * origen o destino). {@code flow}: {@code all}, {@code incoming} (llegan a la sucursal propia) u {@code outgoing}.
     */
    @GetMapping("/search")
    public ResponseEntity<TransferPageResponse> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(defaultValue = "open") String status,
            @RequestParam(defaultValue = "all") String flow,
            @RequestParam(required = false) TransferPriority priority,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long originId,
            @RequestParam(required = false) Long destinationId,
            @RequestParam(required = false) Long productId,
            @RequestParam(defaultValue = "false") boolean onlyMine,
            @RequestParam(required = false, name = "q") String text) {
        requireValid(status, flow);
        PageParams paging = PageParams.of(page, size);
        TransferSearchPort.Criteria criteria = new TransferSearchPort.Criteria(status, flow, priority, from, to, originId, destinationId, productId,
                onlyMine, text == null || text.isBlank() ? null : text.trim(), viewer());
        TransferSearchPort.Page result = transferUseCase.search(criteria, paging, sortBy, "asc".equalsIgnoreCase(direction));
        return ResponseEntity.ok(new TransferPageResponse(result.content().stream().map(TransferRowResponse::from).toList(),
                result.totalElements(), paging.page(), paging.size(), paging.totalPages(result.totalElements())));
    }

    /** Los totales del encabezado de traslados sobre todo lo visible para quien mira. */
    @GetMapping("/summary")
    public ResponseEntity<TransferSummaryResponse> summary() {
        TransferSearchPort.Summary s = transferUseCase.summary(viewer());
        return ResponseEntity.ok(new TransferSummaryResponse(s.open(), s.awaitingMe(), s.freightOwed(), s.freightOwedCount()));
    }

    /** Quien mira; si no es ADMIN debe tener sucursal (sin ella no hay qué mostrarle: 403). */
    private Viewer viewer() {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        if (!current.isAdmin()) {
            current.resolveBranch(null);
        }
        return Viewers.from(current);
    }

    private static void requireValid(String status, String flow) {
        if (!java.util.Set.of("all", "incoming", "outgoing").contains(flow)) {
            throw new IllegalArgumentException("Dirección de traslado desconocida: " + flow);
        }
        if (status.equals("open") || status.equals("all")) {
            return;
        }
        try {
            TransferStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado de traslado desconocido: " + status);
        }
    }
}
