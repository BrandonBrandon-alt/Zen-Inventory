package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
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

    public PurchaseController(PurchaseUseCase purchaseUseCase) {
        this.purchaseUseCase = purchaseUseCase;
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseResponse> createOrder(
            @Valid @RequestBody PurchaseRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        boolean isManager = httpRequest.isUserInRole("ADMIN") || httpRequest.isUserInRole("MANAGER");
        
        CreatePurchaseCommand command = new CreatePurchaseCommand(
                request.supplierId(),
                request.userId(),
                request.branchId(),
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
            @PathVariable Long id,
            @RequestParam Long userId) {
        PurchaseOrder order = purchaseUseCase.approveOrder(id, userId);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/approve-exception")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<PurchaseResponse> approveException(
            @PathVariable Long id,
            @RequestParam Long userId) {
        PurchaseOrder order = purchaseUseCase.approveException(id, userId);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/dispatch")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseResponse> markAsInTransit(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.markAsInTransit(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/receive")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseReceiptResponse> receiveOrder(
            @PathVariable Long id,
            @Valid @RequestBody ReceiveOrderRequest request) {
        
        java.util.Map<Long, co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase.ItemReceiptInfo> itemsInMap = new java.util.HashMap<>();
        request.items().forEach(item -> itemsInMap.put(item.detailId(), 
                new co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase.ItemReceiptInfo(item.quantityReceived(), item.unitId())));

        co.com.zenvory.inventario.purchase.application.port.in.PurchaseReceiptResult result = 
                purchaseUseCase.receiveOrder(id, request.userId(), itemsInMap);
        
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
            @PathVariable Long id,
            @RequestParam Long userId) {
        PurchaseOrder order = purchaseUseCase.closeShortfall(id, userId);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/pay")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<PurchaseResponse> registerPayment(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.registerPayment(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/cancel")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> cancelPurchase(
            @PathVariable Long id,
            @Valid @RequestBody ResolutionRequest request) {
        purchaseUseCase.cancelPurchase(id, request.reason(), request.userId());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<PurchaseResponse> getOrder(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.getOrderById(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<PurchaseResponse>> getAllOrders(
            @RequestParam(required = false) Long supplierId,
            @RequestParam(required = false) Long productId) {
        
        List<PurchaseOrder> allOrders = purchaseUseCase.getAllOrders();
        
        // Filtrado básico (por ahora en memoria, se puede optimizar en repository)
        List<PurchaseResponse> filtered = allOrders.stream()
                .filter(o -> supplierId == null || o.getSupplierId().equals(supplierId))
                .filter(o -> productId == null || o.getDetails().stream().anyMatch(d -> d.getProductId().equals(productId)))
                .map(PurchaseResponse::fromDomain)
                .toList();
                
        return ResponseEntity.ok(filtered);
    }
}
