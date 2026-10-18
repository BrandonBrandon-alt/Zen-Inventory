package co.com.zenvory.inventario.sale.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.sale.application.port.in.CreateReturnRequestCommand;
import co.com.zenvory.inventario.sale.application.port.in.ReturnRequestUseCase;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.application.port.out.ReturnRequestRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.*;
import co.com.zenvory.inventario.sale.domain.exception.InvalidReturnOperationException;
import co.com.zenvory.inventario.sale.domain.exception.ReturnRequestNotFoundException;
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
        // 1. Obtener la venta original con su fila bloqueada: así no puede anularse ni recibir otra solicitud a la vez
        Sale sale = saleManagementUseCase.getSaleForUpdate(command.saleId());
        requireNotCanceled(sale);
        if (!sale.getBranchId().equals(command.branchId())) {
            // El stock devuelto vuelve a la sucursal de la solicitud: tiene que ser la de la venta.
            throw new InvalidReturnOperationException("La venta no pertenece a la sucursal indicada.");
        }

        // 2. Obtener todas las solicitudes previas (Aprobadas y Pendientes)
        List<ReturnRequest> existingRequests = repositoryPort.findBySaleId(command.saleId());

        // Calcular cuánto se ha devuelto o está en proceso de devolución por producto
        Map<Long, Integer> alreadyReturnedOrPending = existingRequests.stream()
                .filter(r -> r.getStatus() != ReturnRequestStatus.RECHAZADA)
                .flatMap(r -> r.getDetails().stream())
                .collect(Collectors.groupingBy(
                        ReturnRequestDetail::getProductId,
                        Collectors.summingInt(ReturnRequestDetail::getQuantity)
                ));

        // 3. Unir las líneas repetidas de la petición: validar cada una por separado dejaría pasar, por ejemplo,
        //    dos líneas de 5 unidades sobre una venta de 5.
        Map<Long, List<CreateReturnRequestCommand.Detail>> requestedByProduct = command.items().stream()
                .collect(Collectors.groupingBy(CreateReturnRequestCommand.Detail::productId, java.util.LinkedHashMap::new, Collectors.toList()));

        // 4. Validar cada producto contra lo vendido (sumando sus líneas) y lo ya devuelto o pendiente
        List<ReturnRequestDetail> requestDetails = requestedByProduct.entrySet().stream()
                .map(entry -> {
                    Long productId = entry.getKey();
                    int sold = sale.soldUnits(productId);
                    if (sold == 0) {
                        throw new InvalidReturnOperationException("El producto ID " + productId + " no pertenece a la venta original.");
                    }
                    int requestedNow = entry.getValue().stream().mapToInt(CreateReturnRequestCommand.Detail::quantity).sum();
                    int previouslyProcessed = alreadyReturnedOrPending.getOrDefault(productId, 0);

                    if (previouslyProcessed + requestedNow > sold) {
                        String name = sale.getDetails().stream().filter(d -> d.getProductId().equals(productId))
                                .findFirst().map(SaleDetail::getProductName).orElse("#" + productId);
                        throw new InvalidReturnOperationException(
                            String.format("Cantidad inválida para %s. Comprado: %d, Ya procesado/pendiente: %d, Solicitado ahora: %d",
                                name, sold, previouslyProcessed, requestedNow));
                    }

                    String reason = entry.getValue().stream().map(CreateReturnRequestCommand.Detail::reasonSpecific)
                            .filter(r -> r != null && !r.isBlank()).distinct().collect(Collectors.joining("; "));
                    return ReturnRequestDetail.create(
                            productId,
                            requestedNow,
                            reason.isEmpty() ? null : reason,
                            // Lo realmente pagado (con descuentos de línea y global), no el precio de lista
                            sale.effectiveUnitPaid(productId)
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
        // Una venta anulada ya repuso su stock: aprobar la devolución lo repondría dos veces.
        requireNotCanceled(saleManagementUseCase.getSaleForUpdate(request.getSaleId()));
        
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
                // Sin costo: reponer unidades devueltas no es una compra y no debe alterar el costo promedio.
                null,
                "Devolución Aprobada Solicitud #" + requestId + ": " + detail.getReasonSpecific(),
                null
            );
        }

        // 4. Marcar la venta original como 'RETURNED' para bloquear futuros flujos (Anulación/Nuevas Solicitudes)
        saleManagementUseCase.updateSaleStatus(request.getSaleId(), SaleStatus.RETURNED);
    }

    private void requireNotCanceled(Sale sale) {
        if (sale.getStatus() == SaleStatus.CANCELED) {
            throw new InvalidReturnOperationException("No se pueden gestionar devoluciones de una venta anulada.");
        }
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
                .orElseThrow(() -> new ReturnRequestNotFoundException(id));
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

    @Override
    public List<ReturnRequest> getAllRequests() {
        return repositoryPort.findAll();
    }
}
