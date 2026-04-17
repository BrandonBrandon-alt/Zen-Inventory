package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.ProductRequest;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.ProductResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada (Input Adapter) que expone los casos de uso
 * del catálogo de productos como una API REST.
 *
 * <p>Sus responsabilidades son:
 * <ol>
 *   <li>Recibir y validar la petición HTTP ({@code @Valid}).</li>
 *   <li>Traducir el DTO de entrada al modelo de dominio.</li>
 *   <li>Delegar la ejecución al puerto de entrada ({@link ProductUseCase}).</li>
 *   <li>Traducir el modelo de dominio al DTO de respuesta.</li>
 * </ol>
 *
 * <p>No contiene lógica de negocio.</p>
 */
@RestController
@RequestMapping("/api/catalog/products")
public class ProductController {

    private final ProductUseCase productUseCase;

    public ProductController(ProductUseCase productUseCase) {
        this.productUseCase = productUseCase;
    }

    /**
     * GET /api/catalog/products
     * Retorna la lista completa de productos del catálogo.
     */
    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAll() {
        List<ProductResponse> response = productUseCase.getAllProducts().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/catalog/products/{id}
     * Retorna un producto por su ID. Devuelve 404 si no existe.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(productUseCase.getProductById(id)));
    }

    /**
     * POST /api/catalog/products
     * Crea un nuevo producto. Devuelve 201 con el producto creado.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        Product created = productUseCase.createProduct(mapToDomain(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(created));
    }

    /**
     * PUT /api/catalog/products/{id}
     * Actualiza un producto existente. Devuelve 404 si no existe.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody ProductRequest request) {
        Product updated = productUseCase.updateProduct(id, mapToDomain(request));
        return ResponseEntity.ok(mapToResponse(updated));
    }

    /**
     * DELETE /api/catalog/products/{id}
     * Elimina un producto por ID. Devuelve 204 sin contenido.
     * Devuelve 404 si el producto no existe.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        productUseCase.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    // ── Mappers privados ────────────────────────────────────────────────────

    private Product mapToDomain(ProductRequest req) {
        return Product.builder()
                .sku(req.sku())
                .name(req.nombre())
                .averageCost(req.costoPromedio())
                .salePrice(req.precioVenta())
                .supplierId(req.proveedorId())
                .unitId(req.unitId())
                .build();
    }

    private ProductResponse mapToResponse(Product product) {
        return ProductResponse.builder()
                .id(product.getId())
                .sku(product.getSku())
                .nombre(product.getName())
                .costoPromedio(product.getAverageCost())
                .precioVenta(product.getSalePrice())
                .proveedorId(product.getSupplierId())
                .unitId(product.getUnitId())
                .unitAbbreviation(product.getUnitAbbreviation())
                .creadoEn(product.getCreatedAt())
                .build();
    }
}
