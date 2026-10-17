package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaSaleRepository extends JpaRepository<SaleEntity, Long> {
    List<SaleEntity> findByBranchId(Long branchId);

    /** Lee la venta bloqueando su fila hasta el fin de la transacción: serializa anulaciones y devoluciones. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT s FROM SaleEntity s WHERE s.id = :id")
    java.util.Optional<SaleEntity> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
