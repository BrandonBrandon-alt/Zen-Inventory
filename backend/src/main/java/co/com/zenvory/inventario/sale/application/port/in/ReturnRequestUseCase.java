package co.com.zenvory.inventario.sale.application.port.in;

import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import java.util.List;

/**
 * Puerto de entrada para gestionar solicitudes de devolución.
 */
public interface ReturnRequestUseCase {
    
    /**
     * Crea una nueva solicitud de devolución.
     */
    ReturnRequest createRequest(CreateReturnRequestCommand command);
    
    /**
     * El Manager aprueba la solicitud y actualiza stock.
     */
    void approveRequest(Long requestId, Long managerId, String comment);
    
    /**
     * El Manager rechaza la solicitud.
     */
    void rejectRequest(Long requestId, Long managerId, String reason);
    
    /**
     * Obtiene una solicitud por su ID.
     */
    ReturnRequest getRequestById(Long id);
    
    /**
     * Lista solicitudes por sucursal.
     */
    List<ReturnRequest> getRequestsByBranch(Long branchId);

    /**
     * Obtiene todas las devoluciones aprobadas para una venta específica (útil para auditoría).
     */
    List<ReturnRequest> getApprovedReturnsBySale(Long saleId);

    /**
     * Listar solicitudes pendientes de aprobación (para Managers).
     */
    List<ReturnRequest> getPendingRequestsByBranch(Long branchId);
}
