package co.com.zenvory.inventario.inventory.domain.exception;

import java.math.BigDecimal;

public class InsufficientStockException extends RuntimeException {
    public InsufficientStockException(String productName, BigDecimal requested, BigDecimal available) {
        super(String.format("Stock insuficiente para %s. Solicitado: %s, Disponible: %s",
                productName, requested.toString(), available.toString()));
    }
}
