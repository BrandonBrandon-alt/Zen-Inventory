package co.com.zenvory.inventario.alert.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.alert.domain.model.StockAlert;

import java.time.LocalDateTime;

public record StockAlertResponse(
        Long id,
        Long branchId,
        Long productId,
        String message,
        LocalDateTime alertDate,
        boolean resolved
) {
    public static StockAlertResponse fromDomain(StockAlert alert) {
        return new StockAlertResponse(
                alert.getId(),
                alert.getBranchId(),
                alert.getProductId(),
                alert.getMessage(),
                alert.getAlertDate(),
                alert.isResolved()
        );
    }
}
