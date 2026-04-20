package co.com.zenvory.inventario.transfer.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.transfer.application.port.in.DispatchTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.ReceiveTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import co.com.zenvory.inventario.transfer.application.port.out.TransferRepositoryPort;
import co.com.zenvory.inventario.transfer.domain.model.Transfer;
import java.util.List;
import co.com.zenvory.inventario.transfer.domain.model.TransferDetail;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;
import co.com.zenvory.inventario.transfer.application.port.in.UpdateQuantityCommand;
import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import org.springframework.context.annotation.Lazy;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

@Service
public class TransferService implements TransferUseCase {

    private final TransferRepositoryPort transferRepositoryPort;
    private final InventoryUseCase inventoryUseCase;
    private final ProductUseCase productUseCase;
    private final AlertUseCase alertUseCase;
    private final UserRepositoryPort userRepositoryPort;

    public TransferService(TransferRepositoryPort transferRepositoryPort, 
                           InventoryUseCase inventoryUseCase, 
                           ProductUseCase productUseCase,
                           @Lazy AlertUseCase alertUseCase,
                           UserRepositoryPort userRepositoryPort) {
        this.transferRepositoryPort = transferRepositoryPort;
        this.inventoryUseCase = inventoryUseCase;
        this.productUseCase = productUseCase;
        this.alertUseCase = alertUseCase;
        this.userRepositoryPort = userRepositoryPort;
    }

    private User getCurrentUser() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated()) {
            throw new IllegalStateException("Usuario no autenticado");
        }
        return userRepositoryPort.findByEmail(auth.getName())
                .orElseThrow(() -> new IllegalArgumentException("Usuario no encontrado en el sistema"));
    }

    @Override
    @Transactional
    public Transfer requestTransfer(RequestTransferCommand command) {
        List<TransferDetail> details = command.items().stream()
                .map(item -> {
                    String productName = productUseCase.getProductById(item.productId()).getName();
                    return TransferDetail.create(item.productId(), productName, item.requestedQuantity());
                })
                .toList();

        User user = getCurrentUser();

        Transfer transfer = Transfer.create(
                command.originBranchId(),
                command.destinationBranchId(),
                command.estimatedArrivalDate(),
                details,
                command.priority() != null ? command.priority() : co.com.zenvory.inventario.transfer.domain.model.TransferPriority.NORMAL,
                user.getId(),
                user.getNombre()
        );

        boolean autoApproved = false;
        // REGLA DE NEGOCIO: Los Managers y Admins auto-aprueban la recepción en destino al solicitar
        String role = user.getRole() != null ? user.getRole().getNombre() : "";
        if ("MANAGER".equals(role) || "ADMIN".equals(role)) {
            transfer.approveDestination(user.getId(), user.getNombre());
            autoApproved = true;
        }

        // REGLA DE NEGOCIO: Reservar stock en la sucursal de origen
        for (TransferDetail detail : details) {
            inventoryUseCase.reserveStock(
                    transfer.getOriginBranchId(),
                    detail.getProductId(),
                    BigDecimal.valueOf(detail.getRequestedQuantity())
            );
        }

        Transfer savedTransfer = transferRepositoryPort.save(transfer);

        if (autoApproved) {
            // Generación de alertas desactivada
        }

        return savedTransfer;
    }

    @Override
    @Transactional
    public Transfer approveDestination(Long id) {
        Transfer transfer = getTransferById(id);
        User user = getCurrentUser();
                
        transfer.approveDestination(user.getId(), user.getNombre());
        return transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public Transfer dispatchTransfer(Long transferId, DispatchTransferCommand command) {
        Transfer transfer = getTransferById(transferId);
        User user = getCurrentUser();
        
        // El agregado valida su estado internamente
        transfer.dispatch(
                command.carrier(),
                command.shippingCost(),
                command.trackingNumber(),
                command.estimatedArrivalDate(),
                user.getId(),
                user.getNombre()
        ); 

        // Operamos contra el Inventario de la sucursal origen
        for (DispatchTransferCommand.DispatchDetail dDetail : command.items()) {
            TransferDetail detail = transfer.getDetails().stream()
                    .filter(d -> d.getId().equals(dDetail.detailId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("No se encontró el detalle en esta transferencia."));
            
            detail.registerDispatch(dDetail.sentQuantity());
            
            String productName = productUseCase.getProductById(detail.getProductId()).getName();
            
            // REGLA DE NEGOCIO: Liberar el stock comprometido antes de retirar físicamente
            // para que la validación de 'hasSufficientStock' no lo cuente dos veces.
            inventoryUseCase.releaseStock(
                    transfer.getOriginBranchId(),
                    detail.getProductId(),
                    BigDecimal.valueOf(detail.getRequestedQuantity())
            );

            inventoryUseCase.withdrawStock(
                    transfer.getOriginBranchId(),
                    detail.getProductId(),
                    productName,
                    BigDecimal.valueOf(detail.getSentQuantity()),
                    null,
                    MovementReason.TRASLADO,
                    user.getId(),
                    transfer.getId(),
                    "TRANSFERENCIA_OUT",
                    null,
                    null
            );
        }

        return transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public Transfer prepareTransfer(Long transferId, List<UpdateQuantityCommand> items) {
        Transfer transfer = getTransferById(transferId);
        User user = getCurrentUser();

        transfer.prepare(user.getId(), user.getNombre());

        // Al autorizar la salida (preparar), buscamos si había una alerta de solicitud para cerrarla
        try {
            List<co.com.zenvory.inventario.alert.domain.model.StockAlert> originAlerts = alertUseCase.getActiveAlerts(transfer.getOriginBranchId());
            for (var alert : originAlerts) {
                if (alert.getMessage().contains("Solicitud de Traslado") && alert.getProductId().equals(transfer.getDetails().get(0).getProductId())) {
                    alertUseCase.dismissAlert(alert.getId(), "Transferencia autorizada por el gerente");
                }
            }
        } catch (Exception e) {
            // No bloqueamos el flujo principal si falla la limpieza de alertas
        }
        
        return transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public Transfer receiveTransfer(Long transferId, ReceiveTransferCommand command) {
        Transfer transfer = getTransferById(transferId);
        User user = getCurrentUser();
        
        boolean hasIssues = false;

        // Procesar detalles primero para calcular si hay novedades
        for (ReceiveTransferCommand.ReceivedDetail rDetail : command.items()) {
            TransferDetail detail = transfer.getDetails().stream()
                    .filter(d -> d.getId().equals(rDetail.detailId()))
                    .findFirst()
                    .orElseThrow(() -> new IllegalArgumentException("No se encontró el detalle en esta transferencia."));
            
            detail.registerReceipt(rDetail.receivedQuantity());
            if (detail.getMissingQuantity() > 0) {
                hasIssues = true;
                // Generación de alerta ISSUE_REPORTED desactivada
            }
            
            // Si llego mayor a cero, ingresar físicamente a la sucursal de destino
            if (detail.getReceivedQuantity() > 0) {
                inventoryUseCase.addStock(
                        transfer.getDestinationBranchId(),
                        detail.getProductId(),
                        BigDecimal.valueOf(detail.getReceivedQuantity()),
                        null,
                        MovementReason.TRASLADO,
                        user.getId(),
                        transfer.getId(),
                        "TRANSFERENCIA_IN",
                        null,
                        command.notes(),
                        null
                );
            }
        }

        transfer.receive(command.notes(), hasIssues, user.getId(), user.getNombre());

        return transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public void cancelTransfer(Long id, String reason) {
        Transfer transfer = getTransferById(id);
        User user = getCurrentUser();

        TransferStatus previousStatus = transfer.getStatus();
        
        transfer.cancel(reason, user.getId(), user.getNombre());

        // Si ya estaba en tránsito, re-ingresar el stock al origen
        if (previousStatus == TransferStatus.IN_TRANSIT) {
            for (TransferDetail detail : transfer.getDetails()) {
                if (detail.getSentQuantity() != null && detail.getSentQuantity() > 0) {
                    inventoryUseCase.addStock(
                            transfer.getOriginBranchId(),
                            detail.getProductId(),
                            BigDecimal.valueOf(detail.getSentQuantity()),
                            null, 
                            MovementReason.DEVOLUCION,
                            user.getId(),
                            transfer.getId(),
                            "TRASLADO_ANULADO_TRANSITO",
                            null, 
                            reason, 
                            null
                    );
                }
            }
        } 
        else {
            for (TransferDetail detail : transfer.getDetails()) {
                inventoryUseCase.releaseStock(
                        transfer.getOriginBranchId(),
                        detail.getProductId(),
                        BigDecimal.valueOf(detail.getRequestedQuantity())
                );
            }
        }

        transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public void rejectTransfer(Long id, String reason) {
        Transfer transfer = getTransferById(id);
        User user = getCurrentUser();

        TransferStatus previousStatus = transfer.getStatus();
        
        transfer.reject(reason, user.getId(), user.getNombre());

        // Si ya estaba en tránsito, el rechazo implica que la mercancía vuelve al origen
        if (previousStatus == TransferStatus.IN_TRANSIT) {
            for (TransferDetail detail : transfer.getDetails()) {
                if (detail.getSentQuantity() != null && detail.getSentQuantity() > 0) {
                    inventoryUseCase.addStock(
                            transfer.getOriginBranchId(),
                            detail.getProductId(),
                            BigDecimal.valueOf(detail.getSentQuantity()),
                            null, 
                            MovementReason.DEVOLUCION,
                            user.getId(),
                            transfer.getId(),
                            "TRASLADO_RECHAZADO_TRANSITO",
                            null, 
                            reason, 
                            null
                    );
                }
            }
        } 
        else {
            for (TransferDetail detail : transfer.getDetails()) {
                inventoryUseCase.releaseStock(
                        transfer.getOriginBranchId(),
                        detail.getProductId(),
                        BigDecimal.valueOf(detail.getRequestedQuantity())
                );
            }
        }

        transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public void resolveAsShrinkage(Long id) {
        Transfer transfer = getTransferById(id);
        User user = getCurrentUser();
                
        transfer.resolveAsShrinkage(user.getId(), user.getNombre());
        transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public void resolveAsResend(Long id) {
        Transfer transfer = getTransferById(id);
        User user = getCurrentUser();
        
        // Crear nuevo traslado para los faltantes
        List<TransferDetail> relativeDetails = transfer.getDetails().stream()
                .filter(d -> d.getMissingQuantity() > 0)
                .map(d -> TransferDetail.create(d.getProductId(), d.getProductName(), d.getMissingQuantity()))
                .toList();
        
        if (!relativeDetails.isEmpty()) {
            Transfer resend = Transfer.resend(transfer, relativeDetails);
            // El reenvío automático se registra como solicitado por el sistema o por el usuario que resuelve 
            transferRepositoryPort.save(resend);
        }
        
        transfer.resolveAsShrinkage(user.getId(), user.getNombre()); // Lo marcamos como resuelto
        transferRepositoryPort.save(transfer);
    }

    @Override
    @Transactional
    public void resolveAsClaim(Long id) {
        Transfer transfer = getTransferById(id);
        User user = getCurrentUser();
        transfer.resolveAsClaim(user.getId(), user.getNombre());
        transferRepositoryPort.save(transfer);
    }

    @Override
    public Transfer getTransferById(Long id) {
        return transferRepositoryPort.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Transferencia no encontrada con id: " + id));
    }

    @Override
    public List<Transfer> getAllTransfers() {
        return transferRepositoryPort.findAll();
    }

    @Override
    public List<Transfer> getTransfersByBranch(Long branchId) {
        return transferRepositoryPort.findByBranch(branchId);
    }

    @Override
    public co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.TransferFulfillmentReport getFulfillmentReport() {
        List<Transfer> transfers = transferRepositoryPort.findAll();
        
        long totalTransfers = transfers.size();
        
        List<Transfer> delivered = transfers.stream()
            .filter(t -> t.getStatus() == TransferStatus.DELIVERED)
            .toList();
            
        long totalDelivered = delivered.size();
        
        long delayedCount = 0;
        double totalDelayHours = 0.0;
        
        for (Transfer t : delivered) {
            if (t.getEstimatedArrivalDate() != null && t.getActualArrivalDate() != null) {
                if (t.getActualArrivalDate().isAfter(t.getEstimatedArrivalDate())) {
                    delayedCount++;
                    java.time.Duration duration = java.time.Duration.between(t.getEstimatedArrivalDate(), t.getActualArrivalDate());
                    totalDelayHours += duration.toHours();
                }
            }
        }
        
        double onTimePercentage = totalDelivered > 0 ? ((double) (totalDelivered - delayedCount) / totalDelivered) * 100.0 : 0.0;
        double averageDelayHours = delayedCount > 0 ? totalDelayHours / delayedCount : 0.0;
        
        return new co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.TransferFulfillmentReport(
            totalTransfers,
            totalDelivered,
            delayedCount,
            onTimePercentage,
            averageDelayHours
        );
    }

    @Override
    public co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse getLogisticsAnalytics() {
        List<Transfer> transfers = transferRepositoryPort.findAll();
        
        long totalTransfers = transfers.size();
        
        List<Transfer> relevant = transfers.stream()
            .filter(t -> t.getStatus() == TransferStatus.DELIVERED || t.getStatus() == TransferStatus.IN_TRANSIT)
            .toList();
            
        long delayedCount = 0;
        double globalDelayHours = 0.0;
        long onTimeCount = 0;
        long completedCount = 0;
        
        java.util.Map<String, co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse.RouteMetrics> routeMap = new java.util.HashMap<>();
        
        for (Transfer t : relevant) {
            String routeKey = t.getOriginBranchId() + "-" + t.getDestinationBranchId();
            
            boolean isDelayed = false;
            double delayHours = 0.0;
            
            if (t.getEstimatedArrivalDate() != null) {
                java.time.LocalDateTime compareDate = t.getStatus() == TransferStatus.DELIVERED ? t.getActualArrivalDate() : java.time.LocalDateTime.now();
                if (compareDate != null && compareDate.isAfter(t.getEstimatedArrivalDate())) {
                    isDelayed = true;
                    delayHours = java.time.Duration.between(t.getEstimatedArrivalDate(), compareDate).toMinutes() / 60.0;
                }
            }
            
            if (t.getStatus() == TransferStatus.DELIVERED) {
                completedCount++;
                if (isDelayed) {
                    delayedCount++;
                    globalDelayHours += delayHours;
                } else {
                    onTimeCount++;
                }
            }
            
            final boolean routeItemDelayed = isDelayed;
            final double routeItemDelayHours = delayHours;
            
            routeMap.compute(routeKey, (key, existing) -> {
                long rTotal = existing == null ? 1 : existing.totalTransfers() + 1;
                long rOnTime = existing == null ? 
                        (t.getStatus() == TransferStatus.DELIVERED && !routeItemDelayed ? 1 : 0) : 
                        existing.onTimeTransfers() + (t.getStatus() == TransferStatus.DELIVERED && !routeItemDelayed ? 1 : 0);
                long rDelayed = existing == null ? 
                        (routeItemDelayed ? 1 : 0) : 
                        existing.delayedTransfers() + (routeItemDelayed ? 1 : 0);
                        
                double currentTotalDelay = existing == null ? 0 : existing.averageDelayHours() * existing.delayedTransfers();
                double rTotalDelayHours = currentTotalDelay + routeItemDelayHours;
                        
                double rAverageDelayHours = rDelayed > 0 ? rTotalDelayHours / rDelayed : 0.0;
                
                BigDecimal rCost = existing == null ? 
                        (t.getShippingCost() != null ? t.getShippingCost() : BigDecimal.ZERO) : 
                        existing.totalShippingCost().add(t.getShippingCost() != null ? t.getShippingCost() : BigDecimal.ZERO);
                        
                long rUrgent = existing == null ? 
                        (t.getPriority() != null && "HIGH".equals(t.getPriority().name()) ? 1 : 0) : 
                        existing.urgentCount() + (t.getPriority() != null && "HIGH".equals(t.getPriority().name()) ? 1 : 0);
                        
                return new co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse.RouteMetrics(
                        t.getOriginBranchId(),
                        t.getDestinationBranchId(),
                        rTotal,
                        rOnTime,
                        rDelayed,
                        rAverageDelayHours,
                        rCost,
                        rUrgent
                );
            });
        }
        
        double onTimePercentage = completedCount > 0 ? ((double) onTimeCount / completedCount) * 100.0 : 0.0;
        double avgDelayHours = delayedCount > 0 ? globalDelayHours / delayedCount : 0.0;
        
        co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse.GlobalMetrics globals = 
            new co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse.GlobalMetrics(
                totalTransfers,
                onTimePercentage,
                delayedCount,
                avgDelayHours
        );
        
        List<co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse.RouteMetrics> sortedRoutes = 
            routeMap.values().stream()
                .sorted((r1, r2) -> Long.compare(r2.totalTransfers(), r1.totalTransfers()))
                .limit(10)
                .toList();
                
        return new co.com.zenvory.inventario.transfer.infrastructure.adapter.in.web.LogisticsAnalyticsResponse(
            globals,
            sortedRoutes
        );
    }
}
