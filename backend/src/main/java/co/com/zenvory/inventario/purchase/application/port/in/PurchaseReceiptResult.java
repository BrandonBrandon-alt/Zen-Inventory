package co.com.zenvory.inventario.purchase.application.port.in;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import java.math.BigDecimal;
import java.util.List;

/**
 * Estructura de datos que informa los efectos técnicos de una recepción de mercancía.
 * 
 * <p>Además de retornar el estado actualizado de la orden, provee el detalle de 
 * cómo la entrada de nuevos ítems afectó el Costo Promedio Ponderado (CPP) 
 * de cada producto en el catálogo.</p>
 * 
 * @param order   Instancia actualizada de la orden de compra.
 * @param impacts Listado de variaciones de costos generadas por la recepción.
 */
public record PurchaseReceiptResult(
    PurchaseOrder order,
    List<CppImpact> impacts
) {
    /**
     * Detalle del impacto financiero en un producto específico tras su recepción.
     * 
     * @param productId        ID del producto afectado.
     * @param productName      Nombre del producto (para reportes directos).
     * @param oldCpp           Costo promedio antes del ingreso.
     * @param newCpp           Costo promedio resultante tras el ingreso.
     * @param quantityReceived Cantidad física que entró al inventario.
     */
    public record CppImpact(
        Long productId,
        String productName,
        BigDecimal oldCpp,
        BigDecimal newCpp,
        BigDecimal quantityReceived
    ) {}
}

