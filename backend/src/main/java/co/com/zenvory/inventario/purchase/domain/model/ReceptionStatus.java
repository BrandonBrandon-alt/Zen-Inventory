package co.com.zenvory.inventario.purchase.domain.model;

/**
 * Representa el estado logístico de una orden de compra.
 */
public enum ReceptionStatus {
    AWAITING_APPROVAL,  // Solicitada pero pendiente de autorización
    PENDING,            // Creada y aprobada, pero no despachada por el proveedor
    IN_TRANSIT,         // Despachada y en camino
    RECEIVED_PARTIAL,   // Recibida con faltantes
    RECEIVED_TOTAL,      // Recibida completamente
    CANCELLED            // Anulada por el usuario
}
