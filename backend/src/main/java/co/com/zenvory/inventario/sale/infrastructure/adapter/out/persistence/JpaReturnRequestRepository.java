package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface JpaReturnRequestRepository extends JpaRepository<ReturnRequestEntity, Long> {
    List<ReturnRequestEntity> findBySucursalId(Long sucursalId);
    List<ReturnRequestEntity> findByVentaId(Long ventaId);
    List<ReturnRequestEntity> findByVentaIdAndEstado(Long ventaId, ReturnRequestStatus estado);
    List<ReturnRequestEntity> findBySucursalIdAndEstado(Long sucursalId, ReturnRequestStatus estado);
}
