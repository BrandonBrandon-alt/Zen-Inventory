package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida que implementa {@link UserRepositoryPort} con Spring Data JPA.
 */
@Component
public class UserPersistenceAdapter implements UserRepositoryPort {

    private final JpaUserRepository jpaRepository;
    private final JpaRoleRepository roleRepository;

    public UserPersistenceAdapter(JpaUserRepository jpaRepository, JpaRoleRepository roleRepository) {
        this.jpaRepository = jpaRepository;
        this.roleRepository = roleRepository;
    }

    @Override
    public Optional<User> findByEmail(String email) {
        return jpaRepository.findByEmail(email).map(UserEntity::toDomain);
    }

    @Override
    public Optional<User> findById(Long id) {
        return jpaRepository.findById(id).map(UserEntity::toDomain);
    }

    @Override
    public List<User> findAll() {
        return jpaRepository.findAll().stream()
                .map(UserEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public User save(User user) {
        UserEntity entity = UserEntity.fromDomain(user);
        return jpaRepository.save(entity).toDomain();
    }

    @Override
    public List<Role> findAllRoles() {
        return roleRepository.findAll().stream()
                .map(RoleEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Role> findRoleById(Long id) {
        return roleRepository.findById(id).map(RoleEntity::toDomain);
    }
}
