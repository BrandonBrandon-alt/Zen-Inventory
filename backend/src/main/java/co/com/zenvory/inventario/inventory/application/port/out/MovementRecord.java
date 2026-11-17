package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;

/** Un movimiento con los nombres que la auditoría muestra (resueltos en la misma consulta). */
public record MovementRecord(InventoryMovement movement, String productName, String branchName, String userName) {
}
