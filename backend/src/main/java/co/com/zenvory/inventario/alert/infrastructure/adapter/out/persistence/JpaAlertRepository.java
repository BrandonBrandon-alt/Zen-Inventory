package co.com.zenvory.inventario.alert.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaAlertRepository extends JpaRepository<AlertEntity, Long> {
    List<AlertEntity> findByBranchIdAndProductIdAndResolvedFalse(Long branchId, Long productId);
    List<AlertEntity> findByBranchIdAndResolvedFalse(Long branchId);
    List<AlertEntity> findByResolvedFalse();
    List<AlertEntity> findByBranchIdAndProductIdAndTypeAndResolvedFalse(Long branchId, Long productId,
            co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType type);
    List<AlertEntity> findByTypeAndResolvedFalse(co.com.zenvory.inventario.alert.domain.model.StockAlert.AlertType type);

    /** Lee la alerta bloqueando su fila: serializa dos resoluciones simultáneas de la misma alerta. */
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("SELECT a FROM AlertEntity a WHERE a.id = :id")
    java.util.Optional<AlertEntity> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") Long id);

    /** Candado de transacción por clave: serializa la creación de la alerta de un (sucursal, producto). */
    @org.springframework.data.jpa.repository.Query(value = "SELECT CAST(pg_advisory_xact_lock(:key) AS text)", nativeQuery = true)
    String advisoryLock(@org.springframework.data.repository.query.Param("key") long key);
}
