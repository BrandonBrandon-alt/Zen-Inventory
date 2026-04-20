package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

/**
 * Repositorio Spring Data JPA para la entidad {@link PriceListEntity}.
 * 
 * <p>Proporciona capacidades de consulta sobre las definiciones globales de 
 * listas de precios, permitiendo filtrar por estado de actividad.</p>
 */
public interface JpaPriceListRepository extends JpaRepository<PriceListEntity, Long> {

    /**
     * Recupera todas las listas de precios que están marcadas como activas.
     * 
     * @return Lista de entidades {@link PriceListEntity}.
     */
    List<PriceListEntity> findByActivaTrue();
}

