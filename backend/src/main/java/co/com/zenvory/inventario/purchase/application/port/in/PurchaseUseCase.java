package co.com.zenvory.inventario.purchase.application.port.in;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;

import java.util.List;

/**
 * Puerto de entrada para los casos de uso relacionados con la gestión de compras.
 * 
 * <p>Define las operaciones de alto nivel para el ciclo de vida de las órdenes de 
 * compra, incluyendo creación, flujo de aprobaciones, registro de recepciones 
 * físicas y saneamiento financiero.</p>
 */
public interface PurchaseUseCase {

    /**
     * Registra una nueva intención de compra en el sistema.
     * 
     * @param command   Datos estructurados del pedido.
     * @param isManager true si el solicitante tiene potestad para autorizar automáticamente.
     * @return La orden de compra persistida.
     */
    PurchaseOrder createOrder(CreatePurchaseCommand command, boolean isManager);

    /**
     * Aprueba una orden que estaba pendiente de validación administrativa.
     * 
     * @param orderId ID de la orden.
     * @param userId  ID del administrador que aprueba.
     * @return La orden en estado PENDING.
     */
    PurchaseOrder approveOrder(Long orderId, Long userId);

    /**
     * Autoriza la continuación de una compra que presenta excepciones técnicas.
     * 
     * @param orderId ID de la orden.
     * @param userId  ID del administrador responsable.
     * @return La orden con excepción aprobada.
     */
    PurchaseOrder approveException(Long orderId, Long userId);

    /**
     * Notifica que el proveedor ha despachado la mercancía y ésta se encuentra en camino.
     * 
     * @param orderId ID de la orden.
     * @return La orden en estado IN_TRANSIT.
     */
    PurchaseOrder markAsInTransit(Long orderId);

    /**
     * Registra el ingreso físico de mercancía al almacén comparando contra lo pedido.
     * 
     * @param orderId ID de la orden.
     * @param userId  ID del operario que recibe.
     * @param items   Mapa de ID de producto e información de recepción (cantidad y unidad).
     * @return Resultado de la operación con detalles de discrepancias si existen.
     */
    PurchaseReceiptResult receiveOrder(Long orderId, Long userId, java.util.Map<Long, ItemReceiptInfo> items);

    /**
     * Información detallada de conteo para un ítem recibido.
     * 
     * @param quantity Cantidad física contada.
     * @param unitId   ID de la unidad de medida utilizada en el reporte.
     */
    record ItemReceiptInfo(java.math.BigDecimal quantity, Long unitId) {}

    /**
     * Cierra una recepción que quedó con faltantes, impidiendo más ingresos.
     * 
     * @param orderId ID de la orden.
     * @param userId  Administrador que autoriza el cierre.
     * @return La orden en estado RECEIVED_TOTAL.
     */
    PurchaseOrder closeShortfall(Long orderId, Long userId);

    /**
     * Registra el pago total de la obligación con el proveedor.
     * 
     * @param orderId ID de la orden.
     * @return La orden en estado de pago PAGADO.
     */
    PurchaseOrder registerPayment(Long orderId);

    /**
     * Anula definitivamente una orden de compra.
     * 
     * @param orderId ID de la orden.
     * @param reason  Motivo de la cancelación.
     * @param userId  Usuario responsable.
     */
    void cancelPurchase(Long orderId, String reason, Long userId);

    /**
     * Recupera el detalle completo de una orden por su ID.
     * 
     * @param orderId ID buscado.
     * @return Modelo de la orden de compra.
     */
    PurchaseOrder getOrderById(Long orderId);

    /**
     * Obtiene el historial completo de órdenes registradas.
     * 
     * @return Lista de órdenes de compra.
     */
    List<PurchaseOrder> getAllOrders();
}

