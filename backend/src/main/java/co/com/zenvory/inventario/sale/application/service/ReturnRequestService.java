package co.com.zenvory.inventario.sale.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.sale.application.port.in.CreateReturnRequestCommand;
import co.com.zenvory.inventario.sale.application.port.in.ReturnRequestUseCase;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.application.port.out.ReturnRequestRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.*;
import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Implementación de la lógica de negocio para gestionar devoluciones.
 */
@Service
public class ReturnRequestService implements ReturnRequestUseCase {

    private final ReturnRequestRepositoryPort repositoryPort;
    private final SaleManagementUseCase saleManagementUseCase;
    private final InventoryUseCase inventoryUseCase;
    private final AlertUseCase alertUseCase;

    public ReturnRequestService(ReturnRequestRepositoryPort repositoryPort, 
                                SaleManagementUseCase saleManagementUseCase,
                                InventoryUseCase inventoryUseCase,
                                @Lazy AlertUseCase alertUseCase) {
        this.repositoryPort = repositoryPort;
        this.saleManagementUseCase = saleManagementUseCase;
        this.inventoryUseCase = inventoryUseCase;
        this.alertUseCase = alertUseCase;
    }

    @Override
    @Transactional
    public ReturnRequest createRequest(CreateReturnRequestCommand command) {
        // 1. Obtener la venta original
        Sale sale = saleManagementUseCase.getSaleById(command.saleId());
        
        // 2. Mapear detalles originales para validación rápida
        Map<Long, SaleDetail> originalDetails = sale.getDetails().stream()
                .collect(Collectors.toMap(SaleDetail::getProductId, d -> d));

        // 3. Obtener todas las solicitudes previas (Aprobadas y Pendientes)
        List<ReturnRequest> existingRequests = repositoryPort.findBySaleId(command.saleId());
        
        // Calcular cuánto se ha devuelto o está en proceso de devolución por producto
        Map<Long, Integer> alreadyReturnedOrPending = existingRequests.stream()
                .filter(r -> r.getStatus() != ReturnRequestStatus.RECHAZADA)
                .flatMap(r -> r.getDetails().stream())
                .collect(Collectors.groupingBy(
                        ReturnRequestDetail::getProductId,
                        Collectors.summingInt(ReturnRequestDetail::getQuantity)
                ));

        // 4. Validar cada ítem solicitado
        List<ReturnRequestDetail> requestDetails = command.items().stream()
                .map(item -> {
                    SaleDetail original = originalDetails.get(item.productId());
                    if (original == null) {
                        throw new IllegalArgumentException("El producto ID " + item.productId() + " no pertenece a la venta original.");
                    }

                    int previouslyProcessed = alreadyReturnedOrPending.getOrDefault(item.productId(), 0);
                    int totalAfterThis = previouslyProcessed + item.quantity();

                    if (totalAfterThis > original.getQuantity()) {
                        throw new IllegalArgumentException(
                            String.format("Cantidad inválida para %s. Comprado: %d, Ya procesado/pendiente: %d, Solicitado ahora: %d",
                                original.getProductName(), original.getQuantity(), previouslyProcessed, item.quantity()));
                    }

                    return ReturnRequestDetail.create(
                            item.productId(),
                            item.quantity(),
                            item.reasonSpecific(),
                            original.getUnitPriceApplied()
                    );
                }).toList();

        // 5. Crear y persistir la solicitud
        ReturnRequest request = ReturnRequest.create(
                command.saleId(),
                command.branchId(),
                command.requesterId(),
                command.generalReason(),
                requestDetails
        );

        ReturnRequest savedRequest = repositoryPort.save(request);



        return savedRequest;
    }

    @Override
    @Transactional
    public void approveRequest(Long requestId, Long managerId, String comment) {
        ReturnRequest request = getRequestById(requestId);
        
        // 1. Transición de estado en el dominio
        request.approve(managerId, comment);
        
        // 2. Persistir cambio
        repositoryPort.save(request);

        // 3. Actualizar Inventario y Kardex (Rollback de Stock)
        for (ReturnRequestDetail detail : request.getDetails()) {
            inventoryUseCase.addStock(
                request.getBranchId(),
                detail.getProductId(),
                BigDecimal.valueOf(detail.getQuantity()),
                null,
                MovementReason.DEVOLUCION,
                managerId,
                request.getSaleId(), // Referenciamos a la venta original para trazabilidad
                "DEVOLUCION",
                detail.getUnitPricePaid(),
                "Devolución Aprobada Solicitud #" + requestId + ": " + detail.getReasonSpecific(),
                null
            );
        }

        // 4. Marcar la venta original como 'RETURNED' para bloquear futuros flujos (Anulación/Nuevas Solicitudes)
        saleManagementUseCase.updateSaleStatus(request.getSaleId(), SaleStatus.RETURNED);
    }

    @Override
    @Transactional
    public void rejectRequest(Long requestId, Long managerId, String reason) {
        ReturnRequest request = getRequestById(requestId);
        request.reject(managerId, reason);
        repositoryPort.save(request);
    }

    @Override
    public ReturnRequest getRequestById(Long id) {
        return repositoryPort.findById(id)
                .orElseThrow(() -> new RuntimeException("Solicitud de devolución no encontrada. ID: " + id));
    }

    @Override
    public List<ReturnRequest> getRequestsByBranch(Long branchId) {
        return repositoryPort.findByBranchId(branchId);
    }

    @Override
    public List<ReturnRequest> getApprovedReturnsBySale(Long saleId) {
        return repositoryPort.findBySaleIdAndStatus(saleId, ReturnRequestStatus.APROBADA);
    }

    @Override
    public List<ReturnRequest> getPendingRequestsByBranch(Long branchId) {
        return repositoryPort.findByBranchIdAndStatus(branchId, ReturnRequestStatus.PENDIENTE);
    }
}
