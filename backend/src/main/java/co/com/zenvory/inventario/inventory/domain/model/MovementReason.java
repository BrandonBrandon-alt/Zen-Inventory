package co.com.zenvory.inventario.inventory.domain.model;

/**
 * Catálogo de justificaciones operativas para la afectación de existencias.
 * 
 * <p>Complementa al {@link MovementType} proporcionando el contexto de negocio 
 * necesario para la auditoría y trazabilidad de los flujos de mercancía.</p>
 */
public enum MovementReason {
    /** Salida por comercialización directa al cliente. */
    VENTA,
    /** Ingreso por adquisición a proveedores. */
    COMPRA,
    /** Movimiento logístico entre bodegas o sucursales. */
    TRASLADO,
    /** Pérdida de valor o cantidad por daño, vencimiento o robo. */
    MERMA,
    /** Retorno de mercancía por parte de un cliente o hacia un proveedor. */
    DEVOLUCION,
    /** Corrección de stock al alza tras inventario físico. */
    AJUSTE_POSITIVO,
    /** Corrección de stock a la baja tras inventario físico. */
    AJUSTE_NEGATIVO
}

