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

