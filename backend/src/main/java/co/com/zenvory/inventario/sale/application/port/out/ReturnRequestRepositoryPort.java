package co.com.zenvory.inventario.sale.application.port.out;

import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestStatus;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida para la persistencia de solicitudes de devolución.
 */
public interface ReturnRequestRepositoryPort {
    ReturnRequest save(ReturnRequest request);
    Optional<ReturnRequest> findById(Long id);
    List<ReturnRequest> findByBranchId(Long branchId);
    List<ReturnRequest> findBySaleId(Long saleId);
    List<ReturnRequest> findBySaleIdAndStatus(Long saleId, ReturnRequestStatus status);
    List<ReturnRequest> findByBranchIdAndStatus(Long branchId, ReturnRequestStatus status);
}
