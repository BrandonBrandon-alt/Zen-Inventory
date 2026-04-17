package co.com.zenvory.inventario.purchase.application.port.out;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;

import java.util.List;
import java.util.Optional;

public interface PurchaseRepositoryPort {
    PurchaseOrder save(PurchaseOrder purchaseOrder);
    Optional<PurchaseOrder> findById(Long id);
    List<PurchaseOrder> findAll();
}
