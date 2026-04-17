package co.com.zenvory.inventario.purchase.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/purchases")
@org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
public class PurchaseController {

    private final PurchaseUseCase purchaseUseCase;

    public PurchaseController(PurchaseUseCase purchaseUseCase) {
        this.purchaseUseCase = purchaseUseCase;
    }

    @PostMapping
    public ResponseEntity<PurchaseResponse> createOrder(@Valid @RequestBody PurchaseRequest request) {
        CreatePurchaseCommand command = new CreatePurchaseCommand(
                request.supplierId(),
                request.userId(),
                request.branchId(),
                request.estimatedArrivalDate(),
                request.paymentDueDays(),
                request.items().stream()
                        .map(item -> new CreatePurchaseCommand.Detail(item.productId(), item.quantity(), item.unitPrice(), item.discountPct()))
                        .toList()
        );

        PurchaseOrder order = purchaseUseCase.createOrder(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/dispatch")
    public ResponseEntity<PurchaseResponse> markAsInTransit(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.markAsInTransit(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/receive")
    public ResponseEntity<PurchaseResponse> receiveOrder(
            @PathVariable Long id,
            @RequestParam Long userId) {
        
        PurchaseOrder order = purchaseUseCase.receiveOrder(id, userId);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @PostMapping("/{id}/pay")
    public ResponseEntity<PurchaseResponse> registerPayment(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.registerPayment(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @GetMapping("/{id}")
    public ResponseEntity<PurchaseResponse> getOrder(@PathVariable Long id) {
        PurchaseOrder order = purchaseUseCase.getOrderById(id);
        return ResponseEntity.ok(PurchaseResponse.fromDomain(order));
    }

    @GetMapping
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
