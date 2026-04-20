package co.com.zenvory.inventario.sale.domain.model;

/**
 * Representa los estados posibles de una solicitud de devolución.
 */
public enum ReturnRequestStatus {
    PENDIENTE,    // Recién creada por el Seller
    APROBADA,     // Procesada por el Manager, stock devuelto
    RECHAZADA     // Denegada por el Manager
}
