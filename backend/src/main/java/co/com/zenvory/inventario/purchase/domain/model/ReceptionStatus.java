package co.com.zenvory.inventario.purchase.domain.model;

/**
 * Representa el estado logístico y el ciclo de vida de una orden de compra.
 * 
 * <p>Permite gestionar el flujo desde el requerimiento inicial hasta la 
 * entrada física de mercancía al almacén, incluyendo estados de excepción como 
 * la anulación o recepciones parciales.</p>
 */
public enum ReceptionStatus {
    /** Orden creada pero pendiente de validación por parte de un administrador o supervisor. */
    AWAITING_APPROVAL,

    /** Orden autorizada y enviada al proveedor, a la espera del despacho. */
    PENDING,

    /** La mercancía ha sido despachada por el proveedor y se encuentra en camino. */
    IN_TRANSIT,

    /** Se ha recibido parte de la mercancía, pero aún faltan unidades por ingresar. */
    RECEIVED_PARTIAL,

    /** La totalidad de los artículos solicitados han sido ingresados satisfactoriamente. */
    RECEIVED_TOTAL,

    /** La orden fue desistida o anulada antes de completarse. */
    CANCELLED
}

