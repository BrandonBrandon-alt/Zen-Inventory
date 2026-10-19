package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.sale.application.port.in.CreateSaleCommand;
import co.com.zenvory.inventario.sale.application.port.in.CreateSaleUseCase;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.domain.model.Sale;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import co.com.zenvory.inventario.shared.infrastructure.security.CurrentUser;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.sale.application.port.out.SaleFilterOptions;
import co.com.zenvory.inventario.sale.application.port.out.SalePage;
import co.com.zenvory.inventario.sale.application.port.out.SaleSearchCriteria;
import co.com.zenvory.inventario.sale.domain.model.SaleStatus;
import org.springframework.format.annotation.DateTimeFormat;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/v1/sales")
public class SaleController {

    private final CreateSaleUseCase createSaleUseCase;
    private final SaleManagementUseCase saleManagementUseCase;
    private final UserRepositoryPort userRepositoryPort;

    public SaleController(CreateSaleUseCase createSaleUseCase, 
                          SaleManagementUseCase saleManagementUseCase,
                          UserRepositoryPort userRepositoryPort) {
        this.createSaleUseCase = createSaleUseCase;
        this.saleManagementUseCase = saleManagementUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<SaleResponse> createSale(@Valid @RequestBody SaleRequest request) {
        // Quién vende y en qué sucursal salen de la sesión, no del cuerpo (que se podría falsificar).
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        CreateSaleCommand command = new CreateSaleCommand(
                current.resolveBranch(request.branchId()),
                current.id(),
                request.customerName(),
                request.customerDocument(),
                request.globalDiscountPercentage(),
                request.priceListId(),
                request.items().stream()
                        .map(item -> new CreateSaleCommand.Detail(
                                item.productId(), 
                                item.quantity(), 
                                item.discountPercentage(),
                                item.priceListId()
                        ))
                        .toList()
        );

        Sale sale = createSaleUseCase.execute(command);
        return ResponseEntity.status(HttpStatus.CREATED).body(SaleResponse.fromDomain(sale));
    }

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<SaleResponse>> getAllSales(@RequestParam(required = false) Long branchId) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);

        List<Sale> sales;

        // REGLA DE SEGURIDAD: Solo los ADMIN pueden ver todo. El resto solo ve su sede.
        if (!current.isAdmin()) {
            sales = saleManagementUseCase.getSalesByBranch(current.resolveBranch(null));
        } else if (branchId != null) {
            sales = saleManagementUseCase.getSalesByBranch(branchId);
        } else {
            sales = saleManagementUseCase.getAllSales();
        }

        return ResponseEntity.ok(sales.stream().map(SaleResponse::fromDomain).toList());
    }

    /** Tamaño máximo de página: protege al servidor de que le pidan todo el historial de una vez. */
    private static final int MAX_PAGE_SIZE = 100;

    /**
     * Historial paginado, filtrado y ordenado en el servidor. La sucursal sigue la misma regla que {@link #getAllSales}:
     * solo el ADMIN puede elegirla o ver todas.
     */
    @GetMapping("/search")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<SalePageResponse> searchSales(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "id") String sortBy,
            @RequestParam(defaultValue = "desc") String direction,
            @RequestParam(required = false) Long branchId,
            @RequestParam(required = false) SaleStatus status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String seller,
            @RequestParam(required = false) String product,
            @RequestParam(required = false) BigDecimal minTotal,
            @RequestParam(required = false) BigDecimal maxTotal,
            @RequestParam(required = false, name = "q") String text) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        Long effectiveBranch = current.isAdmin() ? branchId : current.resolveBranch(null);
        int safePage = Math.max(0, page);
        int safeSize = Math.min(Math.max(1, size), MAX_PAGE_SIZE);

        SalePage result = saleManagementUseCase.searchSales(
                new SaleSearchCriteria(effectiveBranch, status, from, to, blankToNull(seller), blankToNull(product), minTotal, maxTotal, text),
                safePage, safeSize, sortBy, !"desc".equalsIgnoreCase(direction));

        int totalPages = (int) Math.ceil(result.totalElements() / (double) safeSize);
        return ResponseEntity.ok(new SalePageResponse(
                result.content().stream().map(SaleResponse::fromDomain).toList(),
                result.totalElements(), safePage, safeSize, totalPages,
                result.completedCount(), result.completedTotal()));
    }

    /** Vendedores y productos distintos que aparecen en las ventas visibles, para los filtros del historial. */
    @GetMapping("/filter-options")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<SaleFilterOptionsResponse> filterOptions(@RequestParam(required = false) Long branchId) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);
        SaleFilterOptions options = saleManagementUseCase.getFilterOptions(current.isAdmin() ? branchId : current.resolveBranch(null));
        return ResponseEntity.ok(new SaleFilterOptionsResponse(options.sellers(), options.products()));
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value;
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<SaleResponse> getSale(@PathVariable Long id) {
        Sale sale = saleManagementUseCase.getSaleById(id);
        CurrentUser.resolve(userRepositoryPort).requireBranch(sale.getBranchId());
        return ResponseEntity.ok(SaleResponse.fromDomain(sale));
    }

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> cancelSale(@PathVariable Long id, @RequestParam String reason) {
        CurrentUser current = CurrentUser.resolve(userRepositoryPort);

        // REGLA: Los administradores ven todo (null), los gerentes solo su sede.
        Long restrictedBranchId = current.isAdmin() ? null : current.resolveBranch(null);

        saleManagementUseCase.cancelSale(id, reason, restrictedBranchId, current.id());
        return ResponseEntity.noContent().build();
    }
}
