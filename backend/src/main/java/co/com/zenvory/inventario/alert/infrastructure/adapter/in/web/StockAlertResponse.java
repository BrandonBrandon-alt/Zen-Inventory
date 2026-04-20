package co.com.zenvory.inventario.alert.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import java.time.LocalDateTime;

/**
 * Objeto de Transferencia de Datos (DTO) para representar una alerta en la API.
 * 
 * <p>Este record se utiliza para encapsular la información de una alerta que 
 * será enviada al frontend, desacoplando el modelo de dominio de la capa web.</p>
 * 
 * @param id Identificador único de la alerta.
 * @param branchId ID de la sucursal afectada.
 * @param productId ID del producto relacionado.
 * @param message Descripción o mensaje de la alerta.
 * @param alertDate Fecha y hora en que se generó la alerta.
 * @param resolved Indica si la alerta ya ha sido gestionada.
 * @param type Clasificación de la alerta (ej: LOW_STOCK).
 * @param referenceId ID opcional de un documento relacionado (traslado, compra).
 */
public record StockAlertResponse(
        Long id,
        Long branchId,
        Long productId,
        String message,
        LocalDateTime alertDate,
        boolean resolved,
        String type,
        Long referenceId
) {
    /**
     * Mapea una instancia del modelo de dominio StockAlert a este DTO.
     * 
     * @param alert Instancia del dominio a transformar.
     * @return Una nueva instancia de StockAlertResponse.
     */
    public static StockAlertResponse fromDomain(StockAlert alert) {
        return new StockAlertResponse(
                alert.getId(),
                alert.getBranchId(),
                alert.getProductId(),
                alert.getMessage(),
                alert.getAlertDate(),
                alert.isResolved(),
                alert.getType().name(),
                alert.getReferenceId()
        );
    }
}
