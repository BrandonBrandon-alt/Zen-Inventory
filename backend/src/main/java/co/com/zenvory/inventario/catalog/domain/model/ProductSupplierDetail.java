package co.com.zenvory.inventario.catalog.domain.model;

import lombok.Builder;
import java.math.BigDecimal;

/**
 * Representa las condiciones comerciales pactadas entre un producto y un proveedor específico.
 * 
 * <p>Encapsula datos críticos para la cadena de suministro como el precio negociado 
 * y los tiempos de respuesta del proveedor.</p>
 * 
 * @param supplierId Identificador del proveedor.
 * @param negotiatedPrice Precio de compra pactado para este producto con este proveedor.
 * @param deliveryDays Tiempo estimado de entrega en días calendario.
 * @param preferred Indica si este es el proveedor prioritario para el reabastecimiento.
 */
@Builder
public record ProductSupplierDetail(
    Long supplierId,
    BigDecimal negotiatedPrice,
    Integer deliveryDays,
    Boolean preferred
) {}

