package co.com.zenvory.inventario.inventory.domain.event;

import lombok.Getter;
import org.springframework.context.ApplicationEvent;

/**
 * Evento de dominio que se dispara cuando el nivel de stock de un producto
 * en una sucursal ha disminuido, permitiendo reacciones asíncronas o desacopladas (como alertas).
 */
@Getter
public class StockLevelDroppedEvent extends ApplicationEvent {
    private final Long branchId;
    private final Long productId;

    public StockLevelDroppedEvent(Object source, Long branchId, Long productId) {
        super(source);
        this.branchId = branchId;
        this.productId = productId;
    }
}
