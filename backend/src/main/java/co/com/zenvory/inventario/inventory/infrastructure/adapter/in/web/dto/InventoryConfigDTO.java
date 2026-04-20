package co.com.zenvory.inventario.inventory.infrastructure.adapter.in.web.dto;

import java.math.BigDecimal;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class InventoryConfigDTO {
    private BigDecimal minimumStock;
}
