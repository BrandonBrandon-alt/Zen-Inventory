package co.com.zenvory.inventario.sale.application.port.out;

import co.com.zenvory.inventario.sale.domain.model.Sale;

import java.util.List;
import java.util.Optional;

public interface SaleRepositoryPort {
    Sale save(Sale sale);
    Optional<Sale> findById(Long id);
    List<Sale> findAll();
    List<Sale> findByBranchId(Long branchId);
    /** Como {@link #findById} pero bloquea la fila: toda transición de estado de la venta debe leerla así. */
    Optional<Sale> findByIdForUpdate(Long id);
}
