package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.catalog.application.port.in.UnitOfMeasureUseCase;
import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto.*;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada REST para Unidades de Medida.
 *
 * <p>Expone dos grupos de endpoints:
 * <ul>
 *   <li>{@code /api/catalog/units} — CRUD del catálogo de unidades.</li>
 *   <li>{@code /api/catalog/products/{productId}/units} — Gestión de unidades por producto.</li>
 * </ul>
 */
@RestController
public class UnitOfMeasureController {

    private final UnitOfMeasureUseCase unitUseCase;

    public UnitOfMeasureController(UnitOfMeasureUseCase unitUseCase) {
        this.unitUseCase = unitUseCase;
    }

    /** GET /api/catalog/units — Lista todas las unidades de medida disponibles. */
    @GetMapping("/api/catalog/units")
    public ResponseEntity<List<UnitOfMeasureResponse>> getAll() {
        return ResponseEntity.ok(
                unitUseCase.getAllUnits().stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));
    }

    /** GET /api/catalog/units/{id} — Obtiene una unidad por ID. */
    @GetMapping("/api/catalog/units/{id}")
    public ResponseEntity<UnitOfMeasureResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(unitUseCase.getUnitById(id)));
    }

    /** POST /api/catalog/units — Crea una nueva unidad de medida. */
    @PostMapping("/api/catalog/units")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitOfMeasureResponse> create(@Valid @RequestBody UnitOfMeasureRequest request) {
        UnitOfMeasure created = unitUseCase.createUnit(mapToDomain(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(created));
    }

    /** PUT /api/catalog/units/{id} — Actualiza una unidad de medida. */
    @PutMapping("/api/catalog/units/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitOfMeasureResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UnitOfMeasureRequest request) {
        UnitOfMeasure updated = unitUseCase.updateUnit(id, mapToDomain(request));
        return ResponseEntity.ok(mapToResponse(updated));
    }

    /** DELETE /api/catalog/units/{id} — Elimina una unidad de medida. */
    @DeleteMapping("/api/catalog/units/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        unitUseCase.deleteUnit(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * GET /api/catalog/products/{productId}/units
     * Retorna todas las unidades de medida asignadas a un producto específico.
     */
    @GetMapping("/api/catalog/products/{productId}/units")
    public ResponseEntity<List<ProductUnitResponse>> getByProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(
                unitUseCase.getUnitsByProduct(productId).stream()
                        .map(this::mapProductUnitToResponse)
                        .collect(Collectors.toList()));
    }

    /**
     * POST /api/catalog/products/{productId}/units
     * Asocia una unidad de medida a un producto con su factor de conversión.
     */
    @PostMapping("/api/catalog/products/{productId}/units")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductUnitResponse> assignUnit(
            @PathVariable Long productId,
            @Valid @RequestBody ProductUnitRequest request) {
        ProductUnit created = unitUseCase.assignUnitToProduct(mapProductUnitToDomain(productId, request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapProductUnitToResponse(created));
    }

    // ── Mappers ─────────────────────────────────────────────────────────────

    private UnitOfMeasure mapToDomain(UnitOfMeasureRequest req) {
        return UnitOfMeasure.builder()
                .name(req.nombre())
                .abbreviation(req.abreviatura())
                .build();
    }

    private UnitOfMeasureResponse mapToResponse(UnitOfMeasure unit) {
        return UnitOfMeasureResponse.builder()
                .id(unit.getId())
                .nombre(unit.getName())
                .abreviatura(unit.getAbbreviation())
                .build();
    }

    private ProductUnit mapProductUnitToDomain(Long productId, ProductUnitRequest req) {
        return ProductUnit.builder()
                .productId(productId)
                .unitId(req.unidadId())
                .conversionFactor(req.factorConversion())
                .isBase(req.esBase())
                .build();
    }

    private ProductUnitResponse mapProductUnitToResponse(ProductUnit pu) {
        return ProductUnitResponse.builder()
                .id(pu.getId())
                .productoId(pu.getProductId())
                .unidadId(pu.getUnitId())
                .factorConversion(pu.getConversionFactor())
                .esBase(pu.getIsBase())
                .build();
    }
}
