package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Repositorio Spring Data JPA para la entidad {@link ProductUnitEntity}.
 * 
 * <p>Gestiona la persistencia de las equivalencias de unidades por producto.
 * Permite consultar la matriz de conversión configurada para cada artículo 
 * del catálogo.</p>
 */
public interface JpaProductUnitRepository extends JpaRepository<ProductUnitEntity, Long> {

    /**
     * Recupera la lista completa de unidades y presentaciones vinculadas a un producto.
     * 
     * @param productId Identificador del producto.
     * @return Lista de entidades de relación producto-unidad.
     */
    List<ProductUnitEntity> findByProductId(Long productId);
}

