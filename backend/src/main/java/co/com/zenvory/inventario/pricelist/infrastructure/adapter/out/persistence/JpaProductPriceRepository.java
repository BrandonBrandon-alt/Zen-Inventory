package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

/**
 * Repositorio Spring Data JPA para la entidad {@link ProductPriceEntity}.
 * 
 * <p>Gestiona la persistencia de los valores monetarios específicos de artículos 
 * agrupados por listas de precios. Permite operaciones de búsqueda técnica de 
 * precios por producto y limpiezas de registros personalizados.</p>
 */
public interface JpaProductPriceRepository extends JpaRepository<ProductPriceEntity, Long> {

    /**
     * Localiza el registro de precio para un par producto-lista específico.
     * 
     * @param listaId    ID de la lista contenedora.
     * @param productoId ID del producto.
     * @return Optional con la entidad de precio.
     */
    Optional<ProductPriceEntity> findByListaIdAndProductoId(Long listaId, Long productoId);

    /**
     * Recupera todos los precios vinculados a una lista específica.
     * 
     * @param listaId ID de la lista.
     * @return Lista de entidades de precio.
     */
    List<ProductPriceEntity> findByListaId(Long listaId);

    /**
     * Elimina una definición de precio personalizada.
     * 
     * @param listaId    ID de la lista.
     * @param productoId ID del producto.
     */
    void deleteByListaIdAndProductoId(Long listaId, Long productoId);
}

