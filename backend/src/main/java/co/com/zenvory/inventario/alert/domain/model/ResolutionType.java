package co.com.zenvory.inventario.alert.domain.model;

/**
 * Define las formas posibles en que una alerta de stock puede ser resuelta.
 * Ayuda a mantener la trazabilidad de las decisiones de reabastecimiento.
 */
public enum ResolutionType {
    TRANSFER,    // Resuelto pidiendo stock a otra sucursal
    PURCHASE,    // Resuelto comprando al proveedor
    DISMISSED    // Resuelto descartando la alerta (merma, descontinuado, etc.)
}
