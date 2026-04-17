package co.com.zenvory.inventario.alert.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaAlertRepository extends JpaRepository<AlertEntity, Long> {
    List<AlertEntity> findByBranchIdAndProductIdAndResolvedFalse(Long branchId, Long productId);
    List<AlertEntity> findByBranchIdAndResolvedFalse(Long branchId);
    List<AlertEntity> findByResolvedFalse();
}
