package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaSaleRepository extends JpaRepository<SaleEntity, Long>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<SaleEntity> {
    List<SaleEntity> findByBranchId(Long branchId);

    /** Vendedores distintos (de una sucursal o de todas), para el filtro del historial. */
    @org.springframework.data.jpa.repository.Query("""
            SELECT DISTINCT s.userName FROM SaleEntity s
            WHERE s.userName IS NOT NULL AND (:branchId IS NULL OR s.branchId = :branchId)
            ORDER BY s.userName""")
    List<String> findDistinctSellers(@org.springframework.data.repository.query.Param("branchId") Long branchId);

    /** Productos distintos vendidos (en una sucursal o en todas), para el filtro del historial. */
    @org.springframework.data.jpa.repository.Query("""
            SELECT DISTINCT d.productName FROM SaleDetailEntity d
            WHERE d.productName IS NOT NULL AND (:branchId IS NULL OR d.sale.branchId = :branchId)
            ORDER BY d.productName""")
    List<String> findDistinctProducts(@org.springframework.data.repository.query.Param("branchId") Long branchId);

    /** Lee la venta bloqueando su fila hasta el fin de la transacción: serializa anulaciones y devoluciones. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT s FROM SaleEntity s WHERE s.id = :id")
    java.util.Optional<SaleEntity> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);
}
