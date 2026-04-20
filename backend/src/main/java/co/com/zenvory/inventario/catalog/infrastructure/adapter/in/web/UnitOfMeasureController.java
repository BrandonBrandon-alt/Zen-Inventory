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
 * Adaptador de entrada (Primary Adapter) para la gestión de unidades de medida.
 * 
 * <p>Expone endpoints para administrar el catálogo global de unidades 
 * y la asociación de estas con productos específicos (factores de conversión).
 * Centraliza la lógica de comunicación para el nomenclador de magnitudes físicas.</p>
 */
@RestController
public class UnitOfMeasureController {

    /** Puerto de entrada para las operaciones de negocio sobre unidades. */
    private final UnitOfMeasureUseCase unitUseCase;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param unitUseCase Implementación del puerto de entrada.
     */
    public UnitOfMeasureController(UnitOfMeasureUseCase unitUseCase) {
        this.unitUseCase = unitUseCase;
    }


    /**
     * Obtiene todas las unidades de medida disponibles en el sistema.
     * 
     * @return Lista de unidades globales.
     */
    @GetMapping("/api/catalog/units")
    public ResponseEntity<List<UnitOfMeasureResponse>> getAll() {
        return ResponseEntity.ok(
                unitUseCase.getAllUnits().stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));
    }

    /**
     * Busca una unidad de medida por su ID.
     * 
     * @param id ID de la unidad.
     * @return Datos de la unidad encontrada.
     */
    @GetMapping("/api/catalog/units/{id}")
    public ResponseEntity<UnitOfMeasureResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(unitUseCase.getUnitById(id)));
    }

    /**
     * Registra una nueva unidad de medida en el catálogo global.
     * 
     * @param request Datos de la nueva unidad.
     * @return La unidad creada.
     * @status 201 Created si es exitoso.
     */
    @PostMapping("/api/catalog/units")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitOfMeasureResponse> create(@Valid @RequestBody UnitOfMeasureRequest request) {
        UnitOfMeasure created = unitUseCase.createUnit(mapToDomain(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(created));
    }

    /**
     * Actualiza una unidad de medida global.
     * 
     * @param id ID de la unidad a modificar.
     * @param request Nuevos datos.
     * @return La unidad actualizada.
     */
    @PutMapping("/api/catalog/units/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<UnitOfMeasureResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody UnitOfMeasureRequest request) {
        UnitOfMeasure updated = unitUseCase.updateUnit(id, mapToDomain(request));
        return ResponseEntity.ok(mapToResponse(updated));
    }

    /**
     * Elimina una unidad de medida del catálogo global.
     * 
     * @param id ID de la unidad a retirar.
     * @return Respuesta vacía.
     */
    @DeleteMapping("/api/catalog/units/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        unitUseCase.deleteUnit(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Obtiene todas las unidades de medida asociadas a un producto.
     * 
     * @param productId ID del producto de referencia.
     * @return Lista de unidades con sus factores de conversión para el producto.
     */
    @GetMapping("/api/catalog/products/{productId}/units")
    public ResponseEntity<List<ProductUnitResponse>> getByProduct(@PathVariable Long productId) {
        return ResponseEntity.ok(
                unitUseCase.getUnitsByProduct(productId).stream()
                        .map(this::mapProductUnitToResponse)
                        .collect(Collectors.toList()));
    }

    /**
     * Asocia una nueva unidad de medida a un producto.
     * 
     * @param productId ID del producto.
     * @param request Datos de la asociación (factor de conversión, si es base).
     * @return La asociación persistida.
     * @status 201 Created si es exitoso.
     */
    @PostMapping("/api/catalog/products/{productId}/units")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductUnitResponse> assignUnit(
            @PathVariable Long productId,
            @Valid @RequestBody ProductUnitRequest request) {
        ProductUnit created = unitUseCase.assignUnitToProduct(mapProductUnitToDomain(productId, request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapProductUnitToResponse(created));
    }

    /**
     * Mapea un DTO de solicitud al modelo de dominio {@link UnitOfMeasure}.
     */
    private UnitOfMeasure mapToDomain(UnitOfMeasureRequest req) {
        return UnitOfMeasure.builder()
                .name(req.nombre())
                .abbreviation(req.abreviatura())
                .build();
    }

    /**
     * Mapea el modelo de dominio {@link UnitOfMeasure} al DTO de respuesta.
     */
    private UnitOfMeasureResponse mapToResponse(UnitOfMeasure unit) {
        return UnitOfMeasureResponse.builder()
                .id(unit.getId())
                .nombre(unit.getName())
                .abreviatura(unit.getAbbreviation())
                .build();
    }

    /**
     * Mapea un DTO de solicitud al modelo de dominio {@link ProductUnit}.
     */
    private ProductUnit mapProductUnitToDomain(Long productId, ProductUnitRequest req) {
        return ProductUnit.builder()
                .productId(productId)
                .unitId(req.unidadId())
                .conversionFactor(req.factorConversion())
                .isBase(req.esBase())
                .build();
    }

    /**
     * Mapea el modelo de dominio {@link ProductUnit} al DTO de respuesta.
     */
    private ProductUnitResponse mapProductUnitToResponse(ProductUnit pu) {
        return ProductUnitResponse.builder()
                .id(pu.getId())
                .productoId(pu.getProductId())
                .unidadId(pu.getUnitId())
                .nombreUnidad(pu.getUnitName())
                .abreviaturaUnidad(pu.getUnitAbbreviation())
                .factorConversion(pu.getConversionFactor())
                .esBase(pu.getIsBase())
                .build();
    }
}

