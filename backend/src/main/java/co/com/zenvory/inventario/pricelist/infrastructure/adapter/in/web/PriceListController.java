package co.com.zenvory.inventario.pricelist.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.pricelist.application.port.in.PriceListUseCase;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;

/**
 * API REST para gestionar listas de precios.
 * - Los vendedores pueden consultar las listas y los precios (para el POS).
 * - Solo ADMIN/MANAGER pueden configurar precios.
 */
@RestController
@RequestMapping("/api/v1/price-lists")
public class PriceListController {

    private final PriceListUseCase priceListUseCase;

    public PriceListController(PriceListUseCase priceListUseCase) {
        this.priceListUseCase = priceListUseCase;
    }

    /** GET /api/v1/price-lists — Lista todas las listas activas. */
    @GetMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER')")
    public ResponseEntity<List<PriceListResponse>> getAllLists() {
        List<PriceListResponse> response = priceListUseCase.getAllActiveLists().stream()
                .map(pl -> new PriceListResponse(pl.getId(), pl.getNombre(), pl.getDescripcion()))
                .toList();
        return ResponseEntity.ok(response);
    }

    /** GET /api/v1/price-lists/{listaId}/prices — Precios de todos los productos en una lista. */
    @GetMapping("/{listaId}/prices")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER')")
    public ResponseEntity<List<ProductPriceResponse>> getPricesForList(@PathVariable Long listaId) {
        List<ProductPriceResponse> response = priceListUseCase.getPricesForList(listaId).stream()
                .map(pp -> new ProductPriceResponse(pp.getId(), pp.getListaId(), pp.getProductoId(), pp.getPrecio()))
                .toList();
        return ResponseEntity.ok(response);
    }

    /**
     * GET /api/v1/price-lists/{listaId}/products/{productoId}/price
     * Consulta el precio de un producto específico en una lista (útil en el POS para un ítem).
     */
    @GetMapping("/{listaId}/products/{productoId}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER')")
    public ResponseEntity<Map<String, Object>> getProductPrice(
            @PathVariable Long listaId,
            @PathVariable Long productoId) {
        return priceListUseCase.getPriceForProduct(listaId, productoId)
                .map(precio -> ResponseEntity.ok(Map.<String, Object>of("precio", precio, "fromList", true)))
                .orElse(ResponseEntity.ok(Map.of("fromList", false)));
    }

    /**
     * PUT /api/v1/price-lists/{listaId}/products/{productoId}/price
     * Crea o actualiza el precio de un producto en una lista.
     */
    @PutMapping("/{listaId}/products/{productoId}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<ProductPriceResponse> upsertProductPrice(
            @PathVariable Long listaId,
            @PathVariable Long productoId,
            @RequestBody UpsertPriceRequest request) {
        ProductPrice saved = priceListUseCase.upsertProductPrice(listaId, productoId, request.precio());
        return ResponseEntity.ok(new ProductPriceResponse(saved.getId(), saved.getListaId(), saved.getProductoId(), saved.getPrecio()));
    }

    /**
     * DELETE /api/v1/price-lists/{listaId}/products/{productoId}/price
     * Elimina el precio personalizado; el sistema usará el precio base del producto.
     */
    @DeleteMapping("/{listaId}/products/{productoId}/price")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<Void> deleteProductPrice(
            @PathVariable Long listaId,
            @PathVariable Long productoId) {
        priceListUseCase.deleteProductPrice(listaId, productoId);
        return ResponseEntity.noContent().build();
    }

    // ── DTOs internos ─────────────────────────────────────────────────────────

    public record PriceListResponse(Long id, String nombre, String descripcion) {}

    public record ProductPriceResponse(Long id, Long listaId, Long productoId, BigDecimal precio) {}

    public record UpsertPriceRequest(
            @NotNull(message = "El precio es obligatorio")
            @DecimalMin(value = "0.01", message = "El precio debe ser mayor a 0")
            BigDecimal precio
    ) {}
}
