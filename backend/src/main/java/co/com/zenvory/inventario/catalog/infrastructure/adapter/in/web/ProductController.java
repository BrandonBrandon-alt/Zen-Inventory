package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.ProductSupplierDetail;
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
 * Adaptador de entrada (Primary Adapter) para la gestión del catálogo de productos.
 * 
 * <p>Expone endpoints REST para la consulta y administración de la maestra de artículos.
 * Actúa como orquestador entre el protocolo HTTP y los casos de uso definidos en el 
 * dominio, gestionando la validación y transformación de datos.</p>
 */
@RestController
@RequestMapping("/api/catalog/products")
public class ProductController {

    private final ProductUseCase productUseCase;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param productUseCase Puerto de entrada para la lógica de negocio de productos.
     */
    public ProductController(ProductUseCase productUseCase) {
        this.productUseCase = productUseCase;
    }


    /**
     * Obtiene el listado completo de productos del catálogo.
     * 
     * @return Lista de todos los productos registrados.
     */
    @GetMapping
    public ResponseEntity<List<ProductResponse>> getAll() {
        List<ProductResponse> response = productUseCase.getAllProducts().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * Busca un producto por su identificador único.
     * 
     * @param id Identificador primario del producto.
     * @return Datos detallados del producto solicitado.
     * @status 404 Not Found si no existe.
     */
    @GetMapping("/{id}")
    public ResponseEntity<ProductResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(productUseCase.getProductById(id)));
    }

    /**
     * Registra un nuevo producto en el catálogo.
     * 
     * @param request Datos del nuevo producto.
     * @return El producto guardado con su ID y metadatos.
     * @status 201 Created si el registro es exitoso.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<ProductResponse> create(@Valid @RequestBody ProductRequest request) {
        Product created = productUseCase.createProduct(mapToDomain(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(created));
    }

    /**
     * Actualiza la información comercial o técnica de un producto.
     * 
     * @param id ID del producto a modificar.
     * @param request Nuevos datos del producto.
     * @return El producto actualizado.
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
     * Elimina un producto del catálogo (eliminación lógica según políticas de negocio).
     * 
     * @param id ID del producto a retirar.
     * @return Respuesta vacía confirmando la operación.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        productUseCase.deleteProduct(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Mapea un DTO de solicitud al modelo de dominio {@link Product}.
     */
    private Product mapToDomain(ProductRequest req) {
        return Product.builder()
                .sku(req.sku())
                .name(req.nombre())
                .averageCost(req.costoPromedio())
                .salePrice(req.precioVenta())
                .unitId(req.unitId())
                .suppliersDetails(req.suppliers() != null ? 
                    req.suppliers().stream()
                        .map(s -> ProductSupplierDetail.builder()
                            .supplierId(s.supplierId())
                            .negotiatedPrice(s.negotiatedPrice())
                            .deliveryDays(s.deliveryDays())
                            .preferred(s.preferred())
                            .build())
                        .collect(Collectors.toList()) : new java.util.ArrayList<>())
                .active(req.activo())
                .build();
    }

    /**
     * Mapea el modelo de dominio {@link Product} al DTO de respuesta.
     */
    private ProductResponse mapToResponse(Product product) {
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
                .proveedores(product.getSuppliers())
                .build();
    }
}

