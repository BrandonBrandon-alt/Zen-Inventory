package co.com.zenvory.inventario.inventory.domain.model;

/**
 * Clasificación fundamental de la naturaleza contable del movimiento de existencias.
 * 
 * <p>Define el impacto aritmético sobre el saldo del inventario local, permitiendo 
 * categorizar si la operación incrementa o disminuye el stock físico disponible.</p>
 */
public enum MovementType {
    /** Incrementa la existencia en bodega (e.g., Compra, Devolución de cliente). */
    INGRESO,
    /** Disminuye la existencia en bodega (e.g., Venta, Ajuste por merma). */
    RETIRO
}

