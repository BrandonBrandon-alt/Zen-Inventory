package co.com.zenvory.inventario.alert.application.port.out;

import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) para la persistencia de alertas de inventario.
 * 
 * <p>Define el contrato que debe cumplir cualquier adaptador de persistencia
 * (ej: JPA, JDBC) para gestionar el almacenamiento y recuperación de alertas.</p>
 */
public interface AlertRepositoryPort {
    
    /**
     * Persiste una alerta en el repositorio.
     * 
     * @param alert Instancia del modelo de dominio StockAlert a guardar.
     * @return La alerta persistida con su ID generado.
     */
    StockAlert save(StockAlert alert);
    
    /**
     * Busca una alerta por su identificador único.
     * 
     * @param id Identificador de la alerta.
     * @return Un Optional que contiene la alerta si fue encontrada.
     */
    Optional<StockAlert> findById(Long id);
    
    /**
     * Encuentra todas las alertas que aún no han sido resueltas para un binomio específico 
     * sucursal-producto. Útil para evitar duplicación de alertas similares.
     * 
     * @param branchId ID de la sucursal.
     * @param productId ID del producto.
     * @return Lista de alertas pendientes encontradas.
     */
    List<StockAlert> findUnresolvedByBranchAndProduct(Long branchId, Long productId);
    
    /**
     * Recupera todas las alertas actualmente activas para una sucursal.
     * 
     * @param branchId ID de la sucursal.
     * @return Lista de alertas sin resolver.
     */
    List<StockAlert> findActiveAlerts(Long branchId);
    
    /**
     * Obtiene el listado consolidado de alertas activas en todo el sistema.
     * 
     * @return Lista global de alertas activas.
     */
    List<StockAlert> getGlobalActiveAlerts();

    /** Alertas sin resolver de un tipo concreto para una sucursal y producto. */
    List<StockAlert> findUnresolvedByBranchProductAndType(Long branchId, Long productId, StockAlert.AlertType type);

    /** Todas las alertas sin resolver de un tipo (una sola consulta para el escaneo periódico). */
    List<StockAlert> findAllUnresolvedByType(StockAlert.AlertType type);

    /** Como {@link #findById} pero bloquea la fila hasta el fin de la transacción. */
    Optional<StockAlert> findByIdForUpdate(Long id);

    /** Candado de la transacción para (sucursal, producto): la comprobación y creación de una alerta no se intercalan. */
    void lockForCreation(Long branchId, Long productId);
}
