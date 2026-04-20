package co.com.zenvory.inventario.analytics.domain.model;

import java.math.BigDecimal;

/**
 * Representa un producto que destaca en volumen de ventas.
 * 
 * @param productId ID del producto.
 * @param productName Nombre del producto.
 * @param totalSoldQuantity Cantidad total de unidades vendidas en el periodo.
 */
public record TopSellingProduct(
        Long productId,
        String productName,
        BigDecimal totalSoldQuantity
) {}

