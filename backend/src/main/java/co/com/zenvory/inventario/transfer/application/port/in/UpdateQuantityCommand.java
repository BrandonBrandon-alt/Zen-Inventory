package co.com.zenvory.inventario.transfer.application.port.in;

public record UpdateQuantityCommand(
        Long productId,
        Integer requestedQuantity
) {}
