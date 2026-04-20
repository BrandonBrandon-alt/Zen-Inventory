package co.com.zenvory.inventario.sale.domain.model;

/**
 * Representa los posibles estados de una venta en el sistema.
 */
public enum SaleStatus {
    COMPLETED, // Venta realizada con éxito
    CANCELED,  // Venta anulada (stock devuelto)
    RETURNED   // Venta con devolución aprobada (bloqueada)
}
