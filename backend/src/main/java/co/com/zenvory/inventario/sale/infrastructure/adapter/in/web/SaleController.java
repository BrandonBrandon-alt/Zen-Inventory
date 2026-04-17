package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.sale.application.port.in.CreateSaleCommand;
import co.com.zenvory.inventario.sale.application.port.in.CreateSaleUseCase;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.domain.model.Sale;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sales")
public class SaleController {

    private final CreateSaleUseCase createSaleUseCase;
    private final SaleManagementUseCase saleManagementUseCase;

    public SaleController(CreateSaleUseCase createSaleUseCase, SaleManagementUseCase saleManagementUseCase) {
        this.createSaleUseCase = createSaleUseCase;
        this.saleManagementUseCase = saleManagementUseCase;
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER')")
    public ResponseEntity<SaleResponse> createSale(@Valid @RequestBody SaleRequest request) {
        CreateSaleCommand command = new CreateSaleCommand(
                request.branchId(),
                request.userId(),
                request.customerName(),
                request.customerDocument(),
                request.globalDiscountPercentage(),
                request.priceListId(),
                request.items().stream()
                        .map(item -> new CreateSaleCommand.Detail(
                                item.productId(), 
                                item.quantity(), 
                                item.discountPercentage()
                        ))
                        .toList()
        );

        Sale sale = createSaleUseCase.execute(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(SaleResponse.fromDomain(sale));
    }

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<SaleResponse>> getAllSales(@RequestParam(required = false) Long branchId) {
        List<Sale> sales;
        if (branchId != null) {
            sales = saleManagementUseCase.getSalesByBranch(branchId);
        } else {
            sales = saleManagementUseCase.getAllSales();
        }
        return ResponseEntity.ok(sales.stream().map(SaleResponse::fromDomain).toList());
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<SaleResponse> getSale(@PathVariable Long id) {
        Sale sale = saleManagementUseCase.getSaleById(id);
        return ResponseEntity.ok(SaleResponse.fromDomain(sale));
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> cancelSale(@PathVariable Long id, @RequestParam String reason) {
        saleManagementUseCase.cancelSale(id, reason);
        return ResponseEntity.noContent().build();
    }
}
