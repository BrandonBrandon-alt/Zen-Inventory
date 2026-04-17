package co.com.zenvory.inventario.inventory.domain.exception;

public class InventoryNotFoundException extends RuntimeException {
    public InventoryNotFoundException(Long branchId, Long productId) {
        super(String.format("No se encontró registro de inventario local para producto %d en sucursal %d", productId, branchId));
    }
}
