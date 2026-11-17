package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import co.com.zenvory.inventario.inventory.application.port.out.MovementRecord;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** Un movimiento para la auditoría, con los nombres ya resueltos. */
public record MovementAuditResponse(
        Long id,
        LocalDateTime date,
        MovementType type,
        MovementReason reason,
        String subReason,
        BigDecimal quantity,
        BigDecimal finalBalance,
        Long productId,
        String productName,
        Long branchId,
        String branchName,
        Long userId,
        String userName,
        String referenceType,
        Long referenceId,
        String observations
) {
    public static MovementAuditResponse from(MovementRecord record) {
        InventoryMovement m = record.movement();
        return new MovementAuditResponse(m.getId(), m.getDate(), m.getType(), m.getReason(), m.getSubReason(), m.getQuantity(),
                m.getFinalBalance(), m.getProductId(), record.productName(), m.getBranchId(), record.branchName(), m.getUserId(),
                record.userName(), m.getReferenceType(), m.getReferenceId(), m.getObservations());
    }
}
