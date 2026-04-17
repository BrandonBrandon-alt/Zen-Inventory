package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/** Repositorio Spring Data JPA para {@link UserEntity}. */
public interface JpaUserRepository extends JpaRepository<UserEntity, Long> {

    /**
     * Busca un usuario por email.
     * Spring Data genera la query: SELECT * FROM usuario WHERE email = ?
     */
    Optional<UserEntity> findByEmail(String email);
}
