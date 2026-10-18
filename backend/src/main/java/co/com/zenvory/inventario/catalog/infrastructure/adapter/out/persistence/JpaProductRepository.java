package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.lang.NonNull;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio Spring Data JPA para la entidad {@link ProductEntity}.
 * 
 * <p>Extiende de {@link JpaRepository} para proporcionar capacidades CRUD estándar.
 * Incluye consultas optimizadas mediante JPQL para reducir el problema del N+1,
 * cargando de forma ansiosa (Eager) las relaciones críticas.</p>
 */
public interface JpaProductRepository extends JpaRepository<ProductEntity, Long> {

    /**
     * Verifica la existencia de un producto basado en su código SKU.
     * 
     * @param sku Código SKU a validar.
     * @return true si el SKU ya está registrado, false en caso contrario.
     */
    boolean existsBySku(String sku);

    /** Bloquea la fila del producto hasta el fin de la transacción (no se pueden bloquear los JOIN FETCH externos). */
    @org.springframework.data.jpa.repository.Query(value = "SELECT id FROM producto WHERE id = :id FOR UPDATE", nativeQuery = true)
    java.util.List<Long> lockById(@org.springframework.data.repository.query.Param("id") Long id);

    @org.springframework.data.jpa.repository.Modifying(clearAutomatically = true, flushAutomatically = true)
    @org.springframework.data.jpa.repository.Query("UPDATE ProductEntity p SET p.averageCost = :cost WHERE p.id = :id")
    void updateAverageCost(@org.springframework.data.repository.query.Param("id") Long id, @org.springframework.data.repository.query.Param("cost") java.math.BigDecimal cost);

    /** 
     * Recupera todos los productos enriquecidos con su unidad de medida y proveedores.
     * 
     * <p>Utiliza {@code JOIN FETCH} para cargar las relaciones en una única consulta SQL,
     * optimizando el rendimiento de la aplicación.</p>
     * 
     * @return Lista de entidades de producto con relaciones cargadas.
     */
    @Override
    @NonNull
    @Query("SELECT p FROM ProductEntity p JOIN FETCH p.unit LEFT JOIN FETCH p.suppliers")
    List<ProductEntity> findAll();

    /** 
     * Busca un producto por su ID con sus relaciones precargadas.
     * 
     * @param id Identificador único del producto.
     * @return Optional con la entidad encontrada y sus relaciones inicializadas.
     */
    @Override
    @NonNull
    @Query("SELECT p FROM ProductEntity p JOIN FETCH p.unit LEFT JOIN FETCH p.suppliers WHERE p.id = :id")
    Optional<ProductEntity> findById(@NonNull Long id);
}

