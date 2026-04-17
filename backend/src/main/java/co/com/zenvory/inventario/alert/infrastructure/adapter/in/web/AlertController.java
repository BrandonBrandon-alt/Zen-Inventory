package co.com.zenvory.inventario.alert.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/alerts")
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
public class AlertController {

    /** Envelope genérico para respuestas de mensaje — garantiza JSON válido. */
    public record MessageResponse(String message) {}

    public record TransferResolutionRequest(Long originBranchId, Integer quantity) {}
    public record PurchaseResolutionRequest(java.time.LocalDateTime estimatedArrival, java.math.BigDecimal quantity) {}
    public record DismissResolutionRequest(String reason) {}

    private final AlertUseCase alertUseCase;

    public AlertController(AlertUseCase alertUseCase) {
        this.alertUseCase = alertUseCase;
    }

    @PostMapping("/scan")
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
    public ResponseEntity<MessageResponse> resolveAlert(@PathVariable Long id) {
        alertUseCase.resolveAlert(id);
        return ResponseEntity.ok(new MessageResponse("Alerta #" + id + " marcada como resuelta."));
    }

    @PostMapping("/{id}/resolve/transfer")
    public ResponseEntity<MessageResponse> resolveViaTransfer(
            @PathVariable Long id, 
            @RequestBody TransferResolutionRequest request) {
        alertUseCase.resolveViaTransfer(id, request.originBranchId(), request.quantity());
        return ResponseEntity.ok(new MessageResponse("Alerta resuelta mediante solicitud de transferencia interna."));
    }

    @PostMapping("/{id}/resolve/purchase")
    public ResponseEntity<MessageResponse> resolveViaPurchase(
            @PathVariable Long id, 
            @RequestBody PurchaseResolutionRequest request) {
        alertUseCase.resolveViaPurchaseOrder(id, request.estimatedArrival(), request.quantity());
        return ResponseEntity.ok(new MessageResponse("Alerta resuelta mediante generación de orden de compra."));
    }

    @PostMapping("/{id}/resolve/dismiss")
    public ResponseEntity<MessageResponse> dismissAlert(
            @PathVariable Long id, 
            @RequestBody DismissResolutionRequest request) {
        alertUseCase.dismissAlert(id, request.reason());
        return ResponseEntity.ok(new MessageResponse("Alerta descartada exitosamente."));
    }
}
