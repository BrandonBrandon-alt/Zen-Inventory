package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

/** Repositorio Spring Data JPA para {@link RoleEntity}. */
public interface JpaRoleRepository extends JpaRepository<RoleEntity, Long> {
}
