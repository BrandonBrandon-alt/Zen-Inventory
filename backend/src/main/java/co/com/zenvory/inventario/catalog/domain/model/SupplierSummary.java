package co.com.zenvory.inventario.catalog.domain.model;

import java.math.BigDecimal;

/**
 * Vista simplificada de un proveedor en el contexto de un producto específico.
 * 
 * <p>Se utiliza primordialmente para alimentar interfaces de usuario que requieren
 * visualizar la relación comercial sin la carga completa del objeto {@link Supplier}.</p>
 * 
 * @param id Identificador único del proveedor.
 * @param nombre Nombre comercial del proveedor.
 * @param precioPactado Costo de compra negociado para el producto.
 * @param preferido Marca indicativa de proveedor principal.
 * @param tiempoEntregaDias Promesa de entrega en días.
 */
public record SupplierSummary(
    Long id, 
    String nombre, 
    BigDecimal precioPactado, 
    Boolean preferido, 
    Integer tiempoEntregaDias
) {}

