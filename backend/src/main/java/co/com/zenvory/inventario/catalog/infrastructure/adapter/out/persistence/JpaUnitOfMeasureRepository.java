package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repositorio Spring Data JPA para la entidad {@link UnitOfMeasureEntity}.
 * 
 * <p>Gestiona la persistencia de las definiciones de unidades de medida.
 * La implementación es provista automáticamente por Spring Data JPA en tiempo de ejecución.</p>
 */
public interface JpaUnitOfMeasureRepository extends JpaRepository<UnitOfMeasureEntity, Long> {
}


