package co.com.zenvory.inventario.purchase.application.port.in;

import java.math.BigDecimal;
import java.util.List;

/**
 * Comando que encapsula los datos necesarios para registrar una nueva orden de compra.
 * 
 * @param supplierId     ID del proveedor seleccionado.
 * @param userId         ID del usuario que genera la solicitud.
 * @param branchId       ID de la sucursal que recibirá la mercancía.
 * @param leadTimeDays    Días de entrega acordados con el proveedor.
 * @param paymentDueDays Días de plazo para realizar el pago.
 * @param items          Lista de productos y condiciones comerciales solicitadas.
 */
public record CreatePurchaseCommand(
        Long supplierId,
        Long userId,
        Long branchId,
        Integer leadTimeDays,
        Integer paymentDueDays,
        List<Detail> items
) {
    /**
     * Representa la línea de detalle de un producto específico en la solicitud de compra.
     * 
     * @param productId   ID del producto.
     * @param quantity    Cantidad a solicitar.
     * @param unitPrice   Precio unitario negociado.
     * @param discountPct Porcentaje de descuento pactado por ítem.
     */
    public record Detail(
            Long productId,
            BigDecimal quantity,
            BigDecimal unitPrice,
            BigDecimal discountPct
    ) {}
}

