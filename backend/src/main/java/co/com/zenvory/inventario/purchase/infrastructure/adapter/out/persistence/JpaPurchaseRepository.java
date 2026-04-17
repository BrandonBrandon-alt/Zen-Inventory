package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface JpaPurchaseRepository extends JpaRepository<PurchaseOrderEntity, Long> {
    List<PurchaseOrderEntity> findBySupplierId(Long supplierId);
    
    @Query("SELECT DISTINCT p FROM PurchaseOrderEntity p JOIN p.details d WHERE d.productId = :productId")
    List<PurchaseOrderEntity> findByProductIdInDetails(Long productId);
}
