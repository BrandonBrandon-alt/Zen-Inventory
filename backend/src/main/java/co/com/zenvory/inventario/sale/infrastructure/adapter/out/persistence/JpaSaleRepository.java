package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaSaleRepository extends JpaRepository<SaleEntity, Long> {
    List<SaleEntity> findByBranchId(Long branchId);

    @org.springframework.data.jpa.repository.Modifying
    @org.springframework.data.jpa.repository.Query("UPDATE SaleEntity s SET s.status = :status WHERE s.id = :id")
    void updateStatus(Long id, co.com.zenvory.inventario.sale.domain.model.SaleStatus status);
}
