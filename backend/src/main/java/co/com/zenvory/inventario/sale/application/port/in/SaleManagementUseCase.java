package co.com.zenvory.inventario.sale.application.port.in;

import co.com.zenvory.inventario.sale.domain.model.Sale;
import java.util.List;

public interface SaleManagementUseCase {
    List<Sale> getAllSales();
    List<Sale> getSalesByBranch(Long branchId);
    Sale getSaleById(Long id);
    void cancelSale(Long id, String reason, Long restrictedBranchId);
    void updateSaleStatus(Long id, co.com.zenvory.inventario.sale.domain.model.SaleStatus status);
}
