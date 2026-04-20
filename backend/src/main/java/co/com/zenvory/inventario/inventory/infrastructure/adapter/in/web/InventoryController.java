package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto.StockRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;

import java.math.BigDecimal;
import java.util.List;

@RestController
@RequestMapping("/api/v1/inventory")
public class InventoryController {

    private final InventoryUseCase inventoryUseCase;
    private final ProductUseCase productUseCase;
    private final UserRepositoryPort userRepositoryPort;

    public InventoryController(InventoryUseCase inventoryUseCase, ProductUseCase productUseCase, UserRepositoryPort userRepositoryPort) {
        this.inventoryUseCase = inventoryUseCase;
        this.productUseCase = productUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    @GetMapping("/branches/{branchId}/products/{productId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<LocalInventory> getInventory(
            @PathVariable Long branchId, 
            @PathVariable Long productId) {
        LocalInventory inventory = inventoryUseCase.getInventory(branchId, productId);
        return ResponseEntity.ok(inventory);
    }

    @GetMapping("/branches/{branchId}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto.InventoryProductResponse>> getInventoryByBranch(
            @PathVariable Long branchId) {
        return ResponseEntity.ok(inventoryUseCase.getEnrichedInventoryByBranch(branchId).stream()
                .map(inv -> co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto.InventoryProductResponse.builder()
                        .id(inv.getId())
                        .productId(inv.getProductId())
                        .productoNombre(inv.getProductNombre())
                        .sku(inv.getSku())
                        .stockActual(inv.getCurrentQuantity())
                        .stockMinimo(inv.getMinimumStock())
                        .precioVenta(inv.getSalePrice())
                        .costoPromedio(inv.getAverageCost())
                        .unit(inv.getUnit())
                        .activo(inv.getProductActive())
                        .lastUpdated(inv.getLastUpdated())
                        .build())
                .toList());
    }

    @PutMapping("/branches/{branchId}/products/{productId}/config")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<LocalInventory> updateConfig(
            @PathVariable Long branchId,
            @PathVariable Long productId,
            @RequestParam BigDecimal minimumStock) {
        return ResponseEntity.ok(inventoryUseCase.updateMinimumStock(branchId, productId, minimumStock));
    }

    @GetMapping("/branches/{branchId}/products/{productId}/kardex")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<InventoryMovement>> getKardex(
            @PathVariable Long branchId, 
            @PathVariable Long productId) {
        List<InventoryMovement> kardex = inventoryUseCase.getKardex(branchId, productId);
        return ResponseEntity.ok(kardex);
    }

    @PostMapping("/branches/{branchId}/products/{productId}/withdraw")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<Void> withdrawStock(
            @PathVariable Long branchId,
            @PathVariable Long productId,
            @Valid @RequestBody StockRequest request) {
        
        String productName = productUseCase.getProductById(productId).getName();
        
        inventoryUseCase.withdrawStock(
                branchId, 
                productId, 
                productName,
                request.getQuantity(), 
                request.getUnitId(),
                request.getReason(), 
                request.getUserId(), 
                request.getReferenceId(), 
                request.getReferenceType(),
                request.getObservations(),
                request.getSubReason());
                
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/branches/{branchId}/products/{productId}/add")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<Void> addStock(
            @PathVariable Long branchId,
            @PathVariable Long productId,
            @Valid @RequestBody StockRequest request) {
        
        inventoryUseCase.addStock(
                branchId, 
                productId, 
                request.getQuantity(), 
                request.getUnitId(),
                request.getReason(), 
                request.getUserId(), 
                request.getReferenceId(), 
                request.getReferenceType(),
                request.getUnitCost(),
                request.getObservations(),
                request.getSubReason());
                
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/movements")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<InventoryMovement>> getAllMovements() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        User user = userRepositoryPort.findByEmail(auth.getName()).orElseThrow();
        
        List<InventoryMovement> movements;
        if ("MANAGER".equals(user.getRole().getNombre()) || "OPERADOR_INVENTARIO".equals(user.getRole().getNombre())) {
            movements = inventoryUseCase.getMovementsByBranch(user.getSucursalId());
        } else {
            movements = inventoryUseCase.getAllMovements();
        }
        
        return ResponseEntity.ok(movements);
    }
}
