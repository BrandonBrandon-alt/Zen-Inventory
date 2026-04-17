package co.com.zenvory.inventario.inventory.domain.model;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Modelo de Dominio que representa la existencia de un producto en una sucursal específica.
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocalInventory {
    
    private Long id;
    
    // Referencias escalares para no acoplar con otras burbujas (Branch/Catalog)
    private Long branchId;
    private Long productId;
    
    private BigDecimal currentQuantity;
    private BigDecimal minimumStock;
    private LocalDateTime lastUpdated;

    /**
     * Valida si existe stock suficiente para un retiro dado.
     */
    public boolean hasSufficientStock(BigDecimal quantityToWithdraw) {
        if (this.currentQuantity == null || quantityToWithdraw == null) {
            return false;
        }
        return this.currentQuantity.compareTo(quantityToWithdraw) >= 0;
    }
}
