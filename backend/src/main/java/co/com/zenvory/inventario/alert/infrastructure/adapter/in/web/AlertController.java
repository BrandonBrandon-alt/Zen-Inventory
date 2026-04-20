package co.com.zenvory.inventario.alert.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * Adaptador de entrada (Primary Adapter) para la API REST de alertas.
 * 
 * <p>Expone los endpoints necesarios para que el frontend pueda visualizar y 
 * gestionar el ciclo de vida de las alertas de inventario.</p>
 * 
 * <p>Seguridad: Requiere roles de ADMIN, MANAGER o OPERADOR_INVENTARIO 
 * para la mayoría de las operaciones.</p>
 */
@RestController
@RequestMapping("/api/v1/alerts")
@org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
public class AlertController {

    /** 
     * Estructura estándar para respuestas simples de texto. 
     * Garantiza que la respuesta sea un objeto JSON válido {"message": "..."}.
     */
    public record MessageResponse(String message) {}

    /** Requerimientos de datos para resolver una alerta mediante traslado. */
    public record TransferResolutionRequest(Long originBranchId, Integer quantity, Long userId, String priority) {}
    
    /** Requerimientos de datos para resolver una alerta mediante compra. */
    public record PurchaseResolutionRequest(Integer leadTimeDays, java.math.BigDecimal quantity, Long userId, Long supplierId) {}
    
    /** Requerimientos para descartar una alerta sin acción. */
    public record DismissResolutionRequest(String reason) {}

    private final AlertUseCase alertUseCase;

    /**
     * Inyección del caso de uso de alertas.
     * @param alertUseCase Puerto de entrada de la lógica de alertas.
     */
    public AlertController(AlertUseCase alertUseCase) {
        this.alertUseCase = alertUseCase;
    }

    /**
     * Ejecuta manualmente el motor de escaneo de niveles de stock.
     * Solo accesible para administradores debido al alto consumo de recursos.
     * 
     * @return Mensaje de confirmación del inicio del escaneo.
     */
    @PostMapping("/scan")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<MessageResponse> forceScan() {
        alertUseCase.scanForAlerts();
        return ResponseEntity.ok(new MessageResponse("Escaneo de niveles de stock completado exitosamente."));
    }

    /**
     * Obtiene el listado de alertas sin resolver. 
     * Puede filtrar por sucursal o devolver todas si se omite el parámetro.
     * 
     * @param branchId ID opcional de la sucursal a filtrar.
     * @return Lista de alertas formateadas para vista (DTO).
     */
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

    /**
     * Marca una alerta como resuelta de forma manual.
     * 
     * @param id ID de la alerta.
     * @return Confirmación de la resolución.
     */
    @PatchMapping("/{id}/resolve")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<MessageResponse> resolveAlert(@PathVariable Long id) {
        alertUseCase.resolveAlert(id);
        return ResponseEntity.ok(new MessageResponse("Alerta #" + id + " marcada como resuelta."));
    }

    /**
     * Inicia un flujo de resolución creando un Traslado Interno.
     * 
     * @param id ID de la alerta a resolver.
     * @param request Datos del traslado (sucursal origen, cantidad).
     * @return Mensaje de éxito tras delegar la creación del traslado.
     */
    @PostMapping("/{id}/resolve/transfer")
    public ResponseEntity<MessageResponse> resolveViaTransfer(
            @PathVariable Long id, 
            @RequestBody TransferResolutionRequest request) {
        alertUseCase.resolveViaTransfer(id, request.originBranchId(), request.quantity(), request.userId(), request.priority());
        return ResponseEntity.ok(new MessageResponse("Alerta resuelta mediante solicitud de transferencia interna."));
    }

    /**
     * Inicia un flujo de resolución creando una Orden de Compra.
     * Valida permisos de usuario para determinar el estado inicial de la orden.
     * 
     * @param id ID de la alerta.
     * @param request Datos de la compra (proveedor, cantidad).
     * @param httpRequest Datos de la petición para extraer roles de seguridad.
     * @return Mensaje de éxito tras delegar la creación de la orden.
     */
    @PostMapping("/{id}/resolve/purchase")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<MessageResponse> resolveViaPurchase(
            @PathVariable Long id, 
            @RequestBody PurchaseResolutionRequest request,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        
        // Verificamos si el usuario tiene 권한 de aprobación inmediata (isManager)
        boolean isManager = httpRequest.isUserInRole("ADMIN") || httpRequest.isUserInRole("MANAGER");
        
        alertUseCase.resolveViaPurchaseOrder(id, request.leadTimeDays(), request.quantity(), request.userId(), isManager, request.supplierId());
        return ResponseEntity.ok(new MessageResponse("Alerta resuelta mediante generación de orden de compra."));
    }

    /**
     * Descarta la alerta justificando el motivo (resolución manual).
     * 
     * @param id ID de la alerta.
     * @param request Motivo del descarte.
     * @return Confirmación de la operación.
     */
    @PostMapping("/{id}/resolve/dismiss")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER')")
    public ResponseEntity<MessageResponse> dismissAlert(
            @PathVariable Long id, 
            @RequestBody DismissResolutionRequest request) {
        alertUseCase.dismissAlert(id, request.reason());
        return ResponseEntity.ok(new MessageResponse("Alerta descartada exitosamente."));
    }
}
