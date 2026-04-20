package co.com.zenvory.inventario.catalog.infrastructure.adapter.in.web.dto;

import lombok.Builder;
import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO (Data Transfer Object) de salida para la representación de productos.
 * 
 * <p>Define la estructura de datos que se retorna al cliente en las respuestas JSON.
 * Normaliza los nombres de los campos a español para asegurar la consistencia con 
 * el contrato de la API REST externa.</p>
 *
 * @param id Identificador único del recurso.
 * @param sku Código único de identificación logística.
 * @param nombre Nombre descriptivo del producto.
 * @param costoPromedio Valor ponderado de adquisición.
 * @param precioVenta Valor sugerido para el mercado.
 * @param unitId Referencia a la unidad de medida principal.
 * @param unitAbbreviation Símbolo técnico de la unidad de medida.
 * @param activo Estado de disponibilidad actual.
 * @param proveedores Resumen de proveedores vinculados.
 * @param creadoEn Marca temporal de creación del registro.
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

