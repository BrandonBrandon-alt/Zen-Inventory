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

import java.util.List;

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
}
