package co.com.zenvory.inventario.sale.infrastructure.adapter.in.web;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import java.util.List;

public record SaleRequest(
        @NotNull(message = "El ID de la sucursal es obligatorio.")
        Long branchId,

        @NotNull(message = "El ID del usuario es obligatorio.")
        Long userId,

        String customerName,
        String customerDocument,

        java.math.BigDecimal globalDiscountPercentage,

        Long priceListId,

        @NotEmpty(message = "La venta debe contener al menos un producto.")
        @Valid
        List<SaleDetailRequest> items
) {
    public record SaleDetailRequest(
            @NotNull(message = "El ID del producto es obligatorio.")
            Long productId,

            @NotNull(message = "La cantidad es obligatoria.")
            @Positive(message = "La cantidad debe ser mayor a cero.")
            Integer quantity,

            java.math.BigDecimal discountPercentage,
            Long priceListId
    ) {}
}
