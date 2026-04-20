package co.com.zenvory.inventario.sale.application.port.in;

import java.math.BigDecimal;
import java.util.List;

/**
 * Comando para encapsular la intención de solicitar una devolución parcial.
 */
public record CreateReturnRequestCommand(
    Long saleId,
    Long branchId,
    Long requesterId,
    String generalReason,
    List<Detail> items
) {
    public record Detail(
        Long productId,
        Integer quantity,
        String reasonSpecific,
        BigDecimal unitPricePaid
    ) {}
}
