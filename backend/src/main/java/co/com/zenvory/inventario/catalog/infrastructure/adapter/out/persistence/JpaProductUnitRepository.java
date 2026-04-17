package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/** Repositorio Spring Data JPA para {@link ProductUnitEntity}. */
public interface JpaProductUnitRepository extends JpaRepository<ProductUnitEntity, Long> {

    /**
     * Busca todas las unidades asignadas a un producto específico.
     * Spring Data genera la query desde el nombre del método.
     */
    List<ProductUnitEntity> findByProductId(Long productId);
}
