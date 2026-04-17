package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaSaleRepository extends JpaRepository<SaleEntity, Long> {
    List<SaleEntity> findByBranchId(Long branchId);
}
