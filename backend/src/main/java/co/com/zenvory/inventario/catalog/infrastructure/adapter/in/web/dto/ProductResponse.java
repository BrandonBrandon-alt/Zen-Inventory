package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO de salida que representa un producto en la respuesta HTTP.
 *
 * <p>Expone nombres en español para la API REST, desacoplando los nombres
 * del dominio (en inglés) de los nombres del contrato con el cliente.
 * Jackson serializa este record automáticamente a JSON.</p>
 */
@Builder
public record ProductResponse(
        Long id,
        String sku,
        String nombre,
        BigDecimal costoPromedio,
        BigDecimal precioVenta,
        Long unitId,
        String unitAbbreviation,
        Boolean activo,
        java.util.List<co.com.zenvory.inventario.catalog.domain.model.SupplierSummary> proveedores,
        java.time.LocalDateTime creadoEn
) {}
