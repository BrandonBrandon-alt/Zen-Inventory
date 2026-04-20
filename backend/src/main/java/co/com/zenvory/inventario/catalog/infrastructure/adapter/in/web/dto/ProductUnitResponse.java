package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;
import java.math.BigDecimal;

/**
 * DTO (Data Transfer Object) de salida para la representación de las unidades asignadas a un producto.
 * 
 * <p>Expone el detalle de la configuración de empaquetado o pesaje, 
 * incluyendo el factor de conversión y los metadatos de la unidad de medida 
 * para facilitar la visualización en el frontend.</p>
 *
 * @param id Identificador único de la configuración.
 * @param productoId Identificador del producto asociado.
 * @param unidadId Identificador de la unidad de medida.
 * @param nombreUnidad Nombre descriptivo de la unidad.
 * @param abreviaturaUnidad Símbolo técnico de la unidad.
 * @param factorConversion Coeficiente respecto a la unidad base.
 * @param esBase Indica si es la unidad principal de inventario.
 */
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

