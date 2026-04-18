package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;
import java.math.BigDecimal;

/** DTO de salida para representar la relación producto-unidad en la respuesta HTTP. */
@Builder
public record ProductUnitResponse(
        Long id,
        Long productoId,
        Long unidadId,
        String nombreUnidad,
        String abreviaturaUnidad,
        BigDecimal factorConversion,
        Boolean esBase
) {}
