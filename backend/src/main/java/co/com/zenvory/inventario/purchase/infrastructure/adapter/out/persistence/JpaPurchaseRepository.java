package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;
import java.util.List;

/**
 * Repositorio Spring Data JPA para la entidad {@link PurchaseOrderEntity}.
 * 
 * <p>Proporciona capacidades de consulta especializada para el historial de compras, 
 * permitiendo filtrar por proveedor o rastrear órdenes que contengan productos específicos.</p>
 */
@Repository
public interface JpaPurchaseRepository extends JpaRepository<PurchaseOrderEntity, Long> {

    /**
     * Recupera todas las órdenes de compra emitidas a un proveedor específico.
     * 
     * @param supplierId ID del proveedor.
     * @return Lista de entidades de orden de compra.
     */
    List<PurchaseOrderEntity> findBySupplierId(Long supplierId);
    
    /**
     * Localiza órdenes de compra que incluyan un producto determinado en sus líneas de detalle.
     * 
     * @param productId ID del producto buscado.
     * @return Lista de órdenes que contienen el producto.
     */
    @Query("SELECT DISTINCT p FROM PurchaseOrderEntity p JOIN p.details d WHERE d.productId = :productId")
    List<PurchaseOrderEntity> findByProductIdInDetails(Long productId);
}

