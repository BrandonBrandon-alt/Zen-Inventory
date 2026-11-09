package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Filtros de la auditoría de movimientos. Todos son opcionales (`null` = sin filtro); `to` incluye el día completo y
 * `text` busca en producto, SKU, responsable, motivo, documento, observaciones y número, sin distinguir tildes.
 */
public record MovementSearchCriteria(
        Long branchId,
        MovementType type,
        MovementReason reason,
        LocalDate from,
        LocalDate to,
        Long productId,
        Long userId,
        BigDecimal minQuantity,
        BigDecimal maxQuantity,
        boolean onlyObserved,
        String text
) {
}
