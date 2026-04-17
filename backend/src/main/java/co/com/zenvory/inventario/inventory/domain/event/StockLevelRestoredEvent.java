package co.com.zenvory.inventario.inventory.domain.event;

import org.springframework.context.ApplicationEvent;

public class StockLevelRestoredEvent extends ApplicationEvent {
    private final Long branchId;
    private final Long productId;

    public StockLevelRestoredEvent(Object source, Long branchId, Long productId) {
        super(source);
        this.branchId = branchId;
        this.productId = productId;
    }

    public Long getBranchId() {
        return branchId;
    }

    public Long getProductId() {
        return productId;
    }
}
