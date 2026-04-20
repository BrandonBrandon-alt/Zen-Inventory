package co.com.zenvory.inventario.purchase.application.port.out;

import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida para la persistencia de órdenes de compra.
 * 
 * <p>Define el contrato técnico para el almacenamiento y recuperación de datos 
 * de compras, abstrayendo la implementación del mecanismo de persistencia 
 * (JPA, NoSQL, etc.).</p>
 */
public interface PurchaseRepositoryPort {
    /**
     * Persiste o actualiza una orden de compra en el medio de almacenamiento.
     * 
     * @param purchaseOrder Modelo de dominio a guardar.
     * @return La orden guardada con su ID generado (si era nueva).
     */
    PurchaseOrder save(PurchaseOrder purchaseOrder);

    /**
     * Busca una orden de compra específica por su identificador.
     * 
     * @param id ID único de la orden.
     * @return Optional con el modelo de dominio si se encuentra.
     */
    Optional<PurchaseOrder> findById(Long id);

    /**
     * Recupera el listado histórico de todas las órdenes de compra.
     * 
     * @return Lista de órdenes de compra.
     */
    List<PurchaseOrder> findAll();
}

