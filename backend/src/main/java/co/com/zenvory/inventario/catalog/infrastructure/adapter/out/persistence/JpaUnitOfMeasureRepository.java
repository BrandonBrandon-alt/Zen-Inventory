package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio Spring Data JPA para {@link UnitOfMeasureEntity}. */
public interface JpaUnitOfMeasureRepository extends JpaRepository<UnitOfMeasureEntity, Long> {
}

