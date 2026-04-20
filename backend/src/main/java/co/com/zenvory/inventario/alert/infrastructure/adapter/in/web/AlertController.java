package co.com.zenvory.inventario.alert.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
public class AlertController {

    /** Envelope genérico para respuestas de mensaje — garantiza JSON válido. */
    public record MessageResponse(String message) {}

    public record TransferResolutionRequest(Long originBranchId, Integer quantity, Long userId, String priority) {}
    public record PurchaseResolutionRequest(Integer leadTimeDays, java.math.BigDecimal quantity, Long userId, Long supplierId) {}
    public record DismissResolutionRequest(String reason) {}

    private final AlertUseCase alertUseCase;

    public AlertController(AlertUseCase alertUseCase) {
        this.alertUseCase = alertUseCase;
    }

    @PostMapping("/scan")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> forceScan() {
        alertUseCase.scanForAlerts();
        return ResponseEntity.ok(new MessageResponse("Escaneo de niveles de stock completado exitosamente."));
    }

    @GetMapping
    public ResponseEntity<List<StockAlertResponse>> getActiveAlerts(@RequestParam(required = false) Long branchId) {
        List<StockAlertResponse> responses;
        if (branchId != null) {
            responses = alertUseCase.getActiveAlerts(branchId).stream()
                    .map(StockAlertResponse::fromDomain)
                    .toList();
        } else {
            responses = alertUseCase.getGlobalActiveAlerts().stream()
                    .map(StockAlertResponse::fromDomain)
                    .toList();
        }
        return ResponseEntity.ok(responses);
    }

    @PatchMapping("/{id}/resolve")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<MessageResponse> resolveAlert(@PathVariable Long id) {
        alertUseCase.resolveAlert(id);
        return ResponseEntity.ok(new MessageResponse("Alerta #" + id + " marcada como resuelta."));
    }

    @PostMapping("/{id}/resolve/transfer")
    public ResponseEntity<MessageResponse> resolveViaTransfer(
            @PathVariable Long id, 
            @RequestBody TransferResolutionRequest request) {
        alertUseCase.resolveViaTransfer(id, request.originBranchId(), request.quantity(), request.userId(), request.priority());
        return ResponseEntity.ok(new MessageResponse("Alerta resuelta mediante solicitud de transferencia interna."));
    }

    @PostMapping("/{id}/resolve/purchase")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<MessageResponse> resolveViaPurchase(
            @PathVariable Long id, 
            @RequestBody PurchaseResolutionRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        boolean isManager = httpRequest.isUserInRole("ADMIN") || httpRequest.isUserInRole("MANAGER");
        
        alertUseCase.resolveViaPurchaseOrder(id, request.leadTimeDays(), request.quantity(), request.userId(), isManager, request.supplierId());
        return ResponseEntity.ok(new MessageResponse("Alerta resuelta mediante generación de orden de compra."));
    }

    @PostMapping("/{id}/resolve/dismiss")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<MessageResponse> dismissAlert(
            @PathVariable Long id, 
            @RequestBody DismissResolutionRequest request) {
        alertUseCase.dismissAlert(id, request.reason());
        return ResponseEntity.ok(new MessageResponse("Alerta descartada exitosamente."));
    }
}
