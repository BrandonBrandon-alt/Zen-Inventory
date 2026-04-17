package co.com.zenvory.inventario.inventory.domain.model;

/**
 * Motivos por los cuales se afecta el inventario, usado para la trazabilidad operativa.
 */
public enum MovementReason {
    VENTA,
    COMPRA,
    TRASLADO,
    MERMA,
    DEVOLUCION,
    AJUSTE_POSITIVO,
    AJUSTE_NEGATIVO
}
