package co.com.zenvory.inventario.inventory.domain.model;

import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Modelo de Dominio que representa la existencia física y lógica de un producto en una sucursal específica.
 * 
 * <p>Constituye el núcleo del balance de inventarios. Mantiene el control de cantidades 
 * actuales, reservas (comprometido) y umbrales de reabastecimiento para una ubicación lógica.</p>
 */
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LocalInventory {
    
    /** Identificador único del registro de inventario local. */
    private Long id;
    
    /** Identificador de la sucursal o bodega donde se encuentra el stock. */
    private Long branchId;

    /** Identificador del artículo del catálogo. */
    private Long productId;
    
    /** Cantidad total física presente en la ubicación. */
    private BigDecimal currentQuantity;

    /** Cantidad reservada para pedidos pendientes o procesos en curso. */
    private BigDecimal committedQuantity;

    /** Nivel mínimo deseado antes de disparar alertas de reabastecimiento. */
    private BigDecimal minimumStock;

    /** Fecha y hora de la última sincronización o movimiento. */
    private LocalDateTime lastUpdated;

    /**
     * Valida si existe stock disponible real (Actual - Comprometido) para satisfacer un requerimiento.
     * 
     * @param quantityToWithdraw Cantidad que se pretende retirar o reservar.
     * @return true si el saldo disponible es mayor o igual a la cantidad solicitada.
     */
    public boolean hasSufficientStock(BigDecimal quantityToWithdraw) {
        if (this.currentQuantity == null || quantityToWithdraw == null) {
            return false;
        }
        BigDecimal committed = this.committedQuantity != null ? this.committedQuantity : BigDecimal.ZERO;
        BigDecimal available = this.currentQuantity.subtract(committed);
        return available.compareTo(quantityToWithdraw) >= 0;
    }
}

