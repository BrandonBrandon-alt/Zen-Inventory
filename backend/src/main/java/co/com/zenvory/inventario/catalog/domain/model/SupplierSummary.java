package co.com.zenvory.inventario.catalog.domain.model;

/**
 * Resumen de un proveedor asociado a un producto.
 * Usado para la visualización en listas sin cargar toda la entidad.
 */
public record SupplierSummary(Long id, String nombre) {}
