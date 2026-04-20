package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.catalog.application.port.in.SupplierUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.ProductResponse;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.SupplierRequest;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.SupplierResponse;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada REST para el módulo de Proveedores.
 * Expone el CRUD de proveedores bajo {@code /api/catalog/suppliers}.
 */
@RestController
@RequestMapping("/api/catalog/suppliers")
public class SupplierController {

    private final SupplierUseCase supplierUseCase;

    public SupplierController(SupplierUseCase supplierUseCase) {
        this.supplierUseCase = supplierUseCase;
    }

    /** GET /api/catalog/suppliers — Lista todos los proveedores. */
    @GetMapping
    public ResponseEntity<List<SupplierResponse>> getAll() {
        return ResponseEntity.ok(
                supplierUseCase.getAllSuppliers().stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));
    }

    /** GET /api/catalog/suppliers/{id} — Obtiene un proveedor por ID. */
    @GetMapping("/{id}")
    public ResponseEntity<SupplierResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(supplierUseCase.getSupplierById(id)));
    }

    /** POST /api/catalog/suppliers — Crea un nuevo proveedor. */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupplierResponse> create(@Valid @RequestBody SupplierRequest request) {
        Supplier created = supplierUseCase.createSupplier(mapToDomain(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(created));
    }

    /** PUT /api/catalog/suppliers/{id} — Actualiza un proveedor. */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupplierResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.ok(mapToResponse(supplierUseCase.updateSupplier(id, mapToDomain(request))));
    }

    /** DELETE /api/catalog/suppliers/{id} — Elimina un proveedor. */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        supplierUseCase.deleteSupplier(id);
        return ResponseEntity.noContent().build();
    }

    /** GET /api/catalog/suppliers/search?productId=... — Busca proveedores por producto. */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<SupplierResponse>> searchByProduct(@RequestParam Long productId) {
        return ResponseEntity.ok(
                supplierUseCase.getSuppliersByProductId(productId).stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));
    }

    /** GET /api/catalog/suppliers/{id}/products — Lista los productos de un proveedor. */
    @GetMapping("/{id}/products")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<ProductResponse>> getProductsBySupplier(@PathVariable Long id) {
        return ResponseEntity.ok(
                supplierUseCase.getProductsBySupplierId(id).stream()
                        .filter(p -> p.getActive() == null || p.getActive())
                        .map(this::mapProductToResponse)
                        .collect(Collectors.toList()));
    }

    private ProductResponse mapProductToResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .sku(product.getSku())
                .nombre(product.getName())
                .costoPromedio(product.getAverageCost())
                .precioVenta(product.getSalePrice())
                .unitId(product.getUnitId())
                .unitAbbreviation(product.getUnitAbbreviation())
                .activo(product.getActive())
                .creadoEn(product.getCreatedAt())
                .build();
    }

    private Supplier mapToDomain(SupplierRequest req) {
        return Supplier.builder()
                .name(req.nombre())
                .contact(req.contacto())
                .deliveryDays(req.tiempoEntregaDias())
                .build();
    }

    private SupplierResponse mapToResponse(Supplier supplier) {
        return SupplierResponse.builder()
                .id(supplier.getId())
                .nombre(supplier.getName())
                .contacto(supplier.getContact())
                .tiempoEntregaDias(supplier.getDeliveryDays())
                .build();
    }
}
