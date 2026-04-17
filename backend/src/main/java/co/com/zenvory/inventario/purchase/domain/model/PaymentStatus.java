package co.com.zenvory.inventario.purchase.domain.model;

/**
 * Representa el estado de pago de una orden de compra ante el proveedor.
 */
public enum PaymentStatus {
    POR_PAGAR,      // Deuda registrada pero no cancelada
    PAGO_PARCIAL,   // Se ha realizado un abono
    PAGADO          // Deuda totalmente saneada
}
