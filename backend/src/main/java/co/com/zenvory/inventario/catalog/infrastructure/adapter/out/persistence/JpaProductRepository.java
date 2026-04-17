package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repositorio Spring Data JPA para {@link ProductEntity}.
 *
 * <p>Spring genera la implementación automáticamente en tiempo de ejecución.
 * Esta interfaz es un detalle de infraestructura y el dominio nunca la conoce;
 * es usada únicamente por {@link ProductPersistenceAdapter}.</p>
 */
public interface JpaProductRepository extends JpaRepository<ProductEntity, Long> {

    /**
     * Verifica si existe un producto con el SKU dado.
     * Spring Data genera la query automáticamente desde el nombre del método.
     * @param sku Código SKU a buscar.
     * @return {@code true} si existe.
     */
    boolean existsBySku(String sku);
}
