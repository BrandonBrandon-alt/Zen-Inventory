package co.com.zenvory.inventario.purchase.domain.model;

/**
 * Representa el estado financiero de una orden de compra frente al proveedor.
 * 
 * <p>Permite rastrear si la obligación monetaria derivada de la adquisición de 
 * mercancía ha sido satisfecha total, parcial o nulamente.</p>
 */
public enum PaymentStatus {
    /** La deuda ha sido registrada pero no se ha realizado ningún abono. */
    POR_PAGAR,
    
    /** Se ha realizado al menos un pago parcial pero aún resta un saldo pendiente. */
    PAGO_PARCIAL,
    
    /** La obligación financiera ha sido cancelada en su totalidad. */
    PAGADO
}

