package co.com.zenvory.inventario.sale.application.port.in;

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
    // Nombre propio en el OpenAPI: «Detail» chocaba con otros registros anidados y un esquema pisaba al otro.
    @io.swagger.v3.oas.annotations.media.Schema(name = "ReturnItemRequest")
    public record Detail(
        Long saleDetailId,
        Integer quantity,
        String reasonSpecific
    ) {}
}
