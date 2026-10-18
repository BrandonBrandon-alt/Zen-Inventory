package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

/** Repositorio Spring Data JPA para {@link UserEntity}. */
public interface JpaUserRepository extends JpaRepository<UserEntity, Long> {

    /** Busca por correo sin distinguir mayúsculas: "Ana@Zen.com" y "ana@zen.com" son la misma cuenta. */
    @org.springframework.data.jpa.repository.Query("select u from UserEntity u where lower(u.email) = lower(:email)")
    Optional<UserEntity> findByEmail(@org.springframework.data.repository.query.Param("email") String email);

    java.util.List<UserEntity> findBySucursalId(Long sucursalId);
}
