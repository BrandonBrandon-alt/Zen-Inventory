package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

/**
 * Repositorio Spring Data JPA para la entidad {@link BranchEntity}.
 * 
 * <p>Provee las operaciones estándar de persistencia (CRUD) mediante la 
 * abstracción de Spring Data.</p>
 */
public interface JpaBranchRepository extends JpaRepository<BranchEntity, Long> {
}