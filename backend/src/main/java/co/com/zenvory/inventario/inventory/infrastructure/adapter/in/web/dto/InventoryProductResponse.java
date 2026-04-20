package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import lombok.Builder;

/**
 * DTO (Data Transfer Object) proyectado que consolida el estado del inventario con datos del catálogo.
 * 
 * <p>Diseñado para alimentar interfaces críticas como la Terminal de Punto de Venta (POS) 
 * y el monitor de inventario principal, reduciendo la latencia al evitar consultas 
 * incrementales a múltiples micro-servicios lógicos.</p>
 *
 * @param id Identificador único del registro de inventario.
 * @param productId Identificador del producto asociado.
 * @param productoNombre Nombre comercial del artículo.
 * @param sku Código SKU (Stock Keeping Unit).
 * @param stockActual Cantidad física disponible en la ubicación.
 * @param stockMinimo Umbral de seguridad para alertas de reabastecimiento.
 * @param precioVenta Precio de venta vigente al público.
 * @param costoPromedio Costo promedio ponderado calculado.
 * @param unit Abreviatura de la unidad de medida principal.
 * @param activo Estado actual de habilitación del producto.
 * @param lastUpdated Marca temporal de la última actualización de existencias.
 */
@Builder
public record InventoryProductResponse(
        Long id,
        Long productId,
        String productoNombre,
        String sku,
        java.math.BigDecimal stockActual,
        java.math.BigDecimal stockMinimo,
        java.math.BigDecimal precioVenta,
        java.math.BigDecimal costoPromedio,
        String unit,
        Boolean activo,
        java.time.LocalDateTime lastUpdated
) {}

