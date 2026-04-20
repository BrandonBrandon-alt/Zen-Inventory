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
 * Adaptador de entrada (Primary Adapter) para la gestión del catálogo de proveedores.
 * 
 * <p>Expone endpoints REST para administrar la base de datos de proveedores 
 * y consultar las relaciones comerciales con los productos. Actúa como puente 
 * entre la capa web y la lógica de negocio de suministros.</p>
 */
@RestController
@RequestMapping("/api/catalog/suppliers")
public class SupplierController {

    /** Puerto de entrada para las operaciones de negocio sobre proveedores. */
    private final SupplierUseCase supplierUseCase;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param supplierUseCase Implementación del puerto de entrada.
     */
    public SupplierController(SupplierUseCase supplierUseCase) {
        this.supplierUseCase = supplierUseCase;
    }


    /**
     * Obtiene el listado completo de proveedores registrados.
     * 
     * @return Lista de proveedores.
     */
    @GetMapping
    public ResponseEntity<List<SupplierResponse>> getAll() {
        return ResponseEntity.ok(
                supplierUseCase.getAllSuppliers().stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));
    }

    /**
     * Busca un proveedor por su identificador único.
     * 
     * @param id ID del proveedor.
     * @return Datos detallados del proveedor.
     */
    @GetMapping("/{id}")
    public ResponseEntity<SupplierResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(supplierUseCase.getSupplierById(id)));
    }

    /**
     * Registra un nuevo proveedor en el sistema.
     * 
     * @param request Datos del nuevo proveedor.
     * @return El proveedor guardado.
     * @status 201 Created si es exitoso.
     */
    @PostMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupplierResponse> create(@Valid @RequestBody SupplierRequest request) {
        Supplier created = supplierUseCase.createSupplier(mapToDomain(request));
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(created));
    }

    /**
     * Actualiza la información de un proveedor existente.
     * 
     * @param id ID del proveedor a modificar.
     * @param request Nuevos datos.
     * @return El proveedor actualizado.
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<SupplierResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody SupplierRequest request) {
        return ResponseEntity.ok(mapToResponse(supplierUseCase.updateSupplier(id, mapToDomain(request))));
    }

    /**
     * Elimina un proveedor del catálogo.
     * 
     * @param id ID del proveedor a retirar.
     * @return Respuesta vacía.
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        supplierUseCase.deleteSupplier(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Busca los proveedores asociados a un producto particular.
     * 
     * @param productId ID del producto de referencia.
     * @return Lista de proveedores que suministran dicho producto.
     */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<SupplierResponse>> searchByProduct(@RequestParam Long productId) {
        return ResponseEntity.ok(
                supplierUseCase.getSuppliersByProductId(productId).stream()
                        .map(this::mapToResponse)
                        .collect(Collectors.toList()));
    }

    /**
     * Obtiene el listado de productos que suministra un proveedor específico.
     * 
     * @param id ID del proveedor.
     * @return Lista de productos vinculados.
     */
    @GetMapping("/{id}/products")
    @PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<ProductResponse>> getProductsBySupplier(@PathVariable Long id) {
        return ResponseEntity.ok(
                supplierUseCase.getProductsBySupplierId(id).stream()
                        .filter(p -> p.getActive() == null || p.getActive())
                        .map(this::mapProductToResponse)
                        .collect(Collectors.toList()));
    }

    /**
     * Mapea un producto de dominio a su DTO de respuesta especializado.
     */
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

    /**
     * Mapea un DTO de solicitud al modelo de dominio {@link Supplier}.
     */
    private Supplier mapToDomain(SupplierRequest req) {
        return Supplier.builder()
                .name(req.nombre())
                .contact(req.contacto())
                .deliveryDays(req.tiempoEntregaDias())
                .build();
    }

    /**
     * Mapea el modelo de dominio {@link Supplier} al DTO de respuesta.
     */
    private SupplierResponse mapToResponse(Supplier supplier) {
        return SupplierResponse.builder()
                .id(supplier.getId())
                .nombre(supplier.getName())
                .contacto(supplier.getContact())
                .tiempoEntregaDias(supplier.getDeliveryDays())
                .build();
    }
}

