package co.com.zenvory.inventario.inventory.application.port.out;

import java.math.BigDecimal;
import java.util.List;

/** Una página de la auditoría; el total y lo que entró y salió abarcan todo lo que cumple los filtros. */
public record MovementPage(List<MovementRecord> content, long totalElements, BigDecimal totalIn, BigDecimal totalOut) {
}
