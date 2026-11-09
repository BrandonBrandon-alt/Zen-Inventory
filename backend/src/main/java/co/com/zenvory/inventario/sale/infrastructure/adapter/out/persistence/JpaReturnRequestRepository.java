package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaReturnRequestRepository extends JpaRepository<ReturnRequestEntity, Long> {
    /** Bloquea la fila hasta el fin de la transacción. Devuelve vacío si no existe. */
    @org.springframework.data.jpa.repository.Query(value = "SELECT id FROM solicitudes_devolucion WHERE id = :id FOR UPDATE", nativeQuery = true)
    java.util.Optional<Long> lockById(@org.springframework.data.repository.query.Param("id") Long id);

    List<ReturnRequestEntity> findBySucursalId(Long sucursalId);
    List<ReturnRequestEntity> findByVentaId(Long ventaId);
    List<ReturnRequestEntity> findByVentaIdAndEstado(Long ventaId, ReturnRequestStatus estado);
    List<ReturnRequestEntity> findBySucursalIdAndEstado(Long sucursalId, ReturnRequestStatus estado);
}
