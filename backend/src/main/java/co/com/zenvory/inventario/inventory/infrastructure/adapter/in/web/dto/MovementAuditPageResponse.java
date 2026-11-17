package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import java.math.BigDecimal;
import java.util.List;

/** Una página de la auditoría; `totalIn` y `totalOut` suman todo lo que cumple los filtros, no solo la página. */
public record MovementAuditPageResponse(
        List<MovementAuditResponse> content,
        long totalElements,
        int page,
        int size,
        int totalPages,
        BigDecimal totalIn,
        BigDecimal totalOut
) {
}
