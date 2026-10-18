package co.com.zenvory.inventario.sale.application.port.in;

import co.com.zenvory.inventario.sale.domain.model.Sale;
import java.util.List;

public interface SaleManagementUseCase {
    List<Sale> getAllSales();
    List<Sale> getSalesByBranch(Long branchId);
    Sale getSaleById(Long id);
    /** Venta bloqueada hasta el fin de la transacción: para leerla y luego cambiar su estado sin carreras. */
    Sale getSaleForUpdate(Long id);

    /**
     * Anula la venta y repone su stock.
     *
     * @param actorUserId quien anula (queda en el kardex; antes figuraba el vendedor original).
     */
    void cancelSale(Long id, String reason, Long restrictedBranchId, Long actorUserId);
    void updateSaleStatus(Long id, co.com.zenvory.inventario.sale.domain.model.SaleStatus status);
}
