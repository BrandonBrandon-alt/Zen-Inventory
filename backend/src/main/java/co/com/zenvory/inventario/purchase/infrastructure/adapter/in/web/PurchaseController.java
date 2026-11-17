package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.shared.infrastructure.security.CurrentUser;
import co.com.zenvory.inventario.shared.infrastructure.web.ResolutionRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import co.com.zenvory.inventario.purchase.application.port.out.PurchaseSearchPort;
import co.com.zenvory.inventario.purchase.domain.model.PaymentStatus;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.shared.infrastructure.security.Viewers;
import co.com.zenvory.inventario.shared.infrastructure.web.PageParams;
import org.springframework.format.annotation.DateTimeFormat;

@RestController
@RequestMapping("/api/v1/purchases")
public class PurchaseController {

    private final PurchaseUseCase purchaseUseCase;

    private final UserRepositoryPort userRepositoryPort;

    public PurchaseController(PurchaseUseCase purchaseUseCase, UserRepositoryPort userRepositoryPort) {
        this.purchaseUseCase = purchaseUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    /**
     * Orden de la propia sucursal (el ADMIN accede a todas). El usuario que actúa siempre es el de la sesión:
     * los {@code userId} que llegan en la petición se ignoran porque cualquiera podría falsificarlos.
     */
    private CurrentUser requireOrderAccess(Long orderId) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        current.requireBranch(purchaseUseCase.getOrderById(orderId).getBranchId());
        return current;
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseResponse> createOrder(
            @Valid @RequestBody PurchaseRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        boolean isManager = httpRequest.isUserInRole("ADMIN") || httpRequest.isUserInRole("MANAGER");
        
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        CreatePurchaseCommand command = new CreatePurchaseCommand(
                request.supplierId(),
                current.id(),
                current.resolveBranch(request.branchId()),
                request.leadTimeDays(),
                request.paymentDueDays(),
                request.items().stream()
                        .map(item -> new CreatePurchaseCommand.Detail(item.productId(), item.quantity(), item.unitPrice(), item.discountPct()))
                        .toList()
        );

        PurchaseOrder order = purchaseUseCase.createOrder(command, isManager);
        return ResponseEntity.status(HttpStatus.CREATED).body(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/approve")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseResponse> approveOrder(
            @PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.approveOrder(id, requireOrderAccess(id).id());
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/approve-exception")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PurchaseResponse> approveException(
            @PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.approveException(id, requireOrderAccess(id).id());
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/dispatch")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseResponse> markAsInTransit(@PathVariable Long id) {
        requireOrderAccess(id);
        PurchaseOrder order = purchaseUseCase.markAsInTransit(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/receive")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseReceiptResponse> receiveOrder(
            @PathVariable Long id,
            @Valid @RequestBody ReceiveOrderRequest request) {
        
        CurrentUser current = requireOrderAccess(id);
        java.util.Map<Long, co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase.ItemReceiptInfo> itemsInMap = new java.util.HashMap<>();
        request.items().forEach(item -> {
            var previous = itemsInMap.put(item.detailId(),
                    new co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase.ItemReceiptInfo(item.quantityReceived(), item.unitId()));
            if (previous != null) {
                throw new IllegalArgumentException("La línea " + item.detailId() + " aparece repetida en la recepción.");
            }
        });

        co.com.zenvory.inventario.purchase.application.port.in.PurchaseReceiptResult result = 
                purchaseUseCase.receiveOrder(id, current.id(), itemsInMap);
        
        List<PurchaseReceiptResponse.CppImpact> impacts = result.impacts().stream()
                .map(i -> new PurchaseReceiptResponse.CppImpact(
                        i.productId(),
                        i.productName(),
                        i.oldCpp(),
                        i.newCpp(),
                        i.quantityReceived()
                )).toList();

        return ResponseEntity.ok(new PurchaseReceiptResponse(
                result.order().getId(),
                result.order().getReceptionStatus().name(),
                impacts
        ));
    }

    @PostMapping("/{id}/close-shortfall")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PurchaseResponse> closeShortfall(
            @PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.closeShortfall(id, requireOrderAccess(id).id());
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/pay")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseResponse> registerPayment(
            @PathVariable Long id,
            @Valid @RequestBody(required = false) PaymentRequest request) {
        CurrentUser current = requireOrderAccess(id);
        PaymentRequest pay = request != null ? request : new PaymentRequest(null, null, null, null);
        PurchaseOrder order = purchaseUseCase.registerPayment(id, pay.amount(), pay.method(), pay.reference(),
                pay.notes(), current.id(), current.user().getNombre());
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    /** Anula un pago equivocado: queda en el historial marcado como anulado y deja de contar en lo pagado. */
    @PostMapping("/{id}/payments/{paymentId}/void")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseResponse> voidPayment(
            @PathVariable Long id,
            @PathVariable Long paymentId,
            @Valid @RequestBody ResolutionRequest request) {
        CurrentUser current = requireOrderAccess(id);
        PurchaseOrder order = purchaseUseCase.voidPayment(id, paymentId, request.reason(), current.id(), current.user().getNombre());
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/cancel")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> cancelPurchase(
            @PathVariable Long id,
            @Valid @RequestBody ResolutionRequest request) {
        purchaseUseCase.cancelPurchase(id, request.reason(), requireOrderAccess(id).id());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseResponse> getOrder(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.getOrderById(id);
        CurrentUser.resolve(userRepositoryPort).requireBranch(order.getBranchId());
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<PurchaseResponse>> getAllOrders(
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) Long productId) {
        
        // Solo el ADMIN ve las órdenes de todas las sucursales; el resto, las de la suya (filtrado en base de datos).
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        List<PurchaseOrder> scoped = current.isAdmin()
                ? purchaseUseCase.getAllOrders()
                : purchaseUseCase.getOrdersByBranch(current.resolveBranch(null));

        List<PurchaseResponse> filtered = scoped.stream()
                .filter(o -> supplierId == null || o.getSupplierId().equals(supplierId))
                .filter(o -> productId == null || o.getDetails().stream().anyMatch(d -> d.getProductId().equals(productId)))
                .map(PurchaseResponse::fromDomain)
                .toList();
                
        return ResponseEntity.ok(filtered);
    }

    public record PurchaseRowResponse(Long id, ReceptionStatus reception, PaymentStatus payment, Long supplierId, String supplierName,
                                      Long branchId, String branchName, BigDecimal total, BigDecimal balance, boolean overdue,
                                      LocalDateTime requestDate, boolean awaitsMe) {
        static PurchaseRowResponse from(PurchaseSearchPort.Row r) {
            return new PurchaseRowResponse(r.id(), r.reception(), r.payment(), r.supplierId(), r.supplierName(), r.branchId(), r.branchName(),
                    r.total(), r.balance(), r.overdue(), r.requestDate(), r.awaitsMe());
        }
    }

    public record PurchasePageResponse(List<PurchaseRowResponse> content, long totalElements, int page, int size, int totalPages) {
    }

    public record PurchaseSummaryResponse(long open, long awaitingMe, BigDecimal owed, long owedCount, long overdue) {
    }

    /** La lista de la pantalla de compras, paginada en el servidor. Quien no es ADMIN ve solo su sucursal. */
    @GetMapping("/search")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchasePageResponse> search(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "25") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(defaultValue = "open") String status,
            @RequestParam(required = false) PaymentStatus payment,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) Long productId,
            @RequestParam(required = false) BigDecimal minTotal,
            @RequestParam(required = false) BigDecimal maxTotal,
            @RequestParam(defaultValue = "false") boolean onlyMine,
            @RequestParam(required = false, name = "q") String text) {
        requireValidStatus(status);
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        PageParams paging = PageParams.of(page, size);
        PurchaseSearchPort.Criteria criteria = new PurchaseSearchPort.Criteria(status, payment, from, to, supplierId, scopedBranch(current, branchId),
                productId, minTotal, maxTotal, onlyMine, text == null || text.isBlank() ? null : text.trim(), Viewers.from(current));
        PurchaseSearchPort.Page result = purchaseUseCase.search(criteria, paging, sortBy, "asc".equalsIgnoreCase(direction));
        return ResponseEntity.ok(new PurchasePageResponse(result.content().stream().map(PurchaseRowResponse::from).toList(),
                result.totalElements(), paging.page(), paging.size(), paging.totalPages(result.totalElements())));
    }

    /** Los totales del encabezado de compras sobre todo lo visible para quien mira. */
    @GetMapping("/summary")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseSummaryResponse> summary(@RequestParam(required = false) Long branchId) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        PurchaseSearchPort.Summary s = purchaseUseCase.summary(scopedBranch(current, branchId), Viewers.from(current));
        return ResponseEntity.ok(new PurchaseSummaryResponse(s.open(), s.awaitingMe(), s.owed(), s.owedCount(), s.overdue()));
    }

    /** El ADMIN elige la sucursal (o todas); el resto siempre ve la suya, pida lo que pida. */
    private static Long scopedBranch(CurrentUser current, Long requested) {
        return current.isAdmin() ? requested : current.resolveBranch(null);
    }

    private static void requireValidStatus(String status) {
        if (status.equals("open") || status.equals("all")) {
            return;
        }
        try {
            ReceptionStatus.valueOf(status);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Estado de compra desconocido: " + status);
        }
    }
}
