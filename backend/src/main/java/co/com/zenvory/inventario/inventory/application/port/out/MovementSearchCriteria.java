package co.com.zenvory.inventario.inventory.application.port.out;

import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * Filtros de la auditoría de movimientos y del kardex. Todos son opcionales (`null` o lista vacía = sin filtro); `to` incluye el día completo y
 * `text` busca en producto, SKU, responsable, motivo, documento, observaciones y número, sin distinguir tildes.
 */
public record MovementSearchCriteria(
        Long branchId,
        MovementType type,
        List<MovementReason> reasons,
        LocalDate from,
        LocalDate to,
        List<Long> productIds,
        Long userId,
        BigDecimal minQuantity,
        BigDecimal maxQuantity,
        boolean onlyObserved,
        String text
) {
}
