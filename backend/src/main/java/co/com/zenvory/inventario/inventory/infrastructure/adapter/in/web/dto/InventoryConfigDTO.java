package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO (Data Transfer Object) de entrada para la configuración técnica del inventario local.
 * 
 * <p>Se utiliza principalmente para la actualización de parámetros operativos 
 * específicos por sucursal, como el nivel de stock mínimo de seguridad.</p>
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryConfigDTO {
    /** Nuevo valor para el umbral de stock mínimo de seguridad. */
    private BigDecimal minimumStock;
}

