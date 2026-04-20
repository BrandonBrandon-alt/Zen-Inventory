package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (Secondary Adapter) para la persistencia de usuarios y roles.
 * 
 * <p>Implementa {@link UserRepositoryPort} utilizando repositorios de Spring Data JPA
 * para interactuar con la base de datos relacional. Se encarga de la traducción
 * entre entidades JPA ({@link UserEntity}, {@link RoleEntity}) y modelos de dominio.</p>
 */
@Component
public class UserPersistenceAdapter implements UserRepositoryPort {

    private final JpaUserRepository jpaRepository;
    private final JpaRoleRepository roleRepository;

    /**
     * Constructor para inyección de dependencias.
     * 
     * @param jpaRepository Repositorio JPA para usuarios.
     * @param roleRepository Repositorio JPA para roles.
     */
    public UserPersistenceAdapter(JpaUserRepository jpaRepository, JpaRoleRepository roleRepository) {
        this.jpaRepository = jpaRepository;
        this.roleRepository = roleRepository;
    }

    /**
     * Busca un usuario por su dirección de correo electrónico.
     * 
     * @param email Correo a buscar.
     * @return El usuario envuelto en un {@link Optional}.
     */
    @Override
    public Optional<User> findByEmail(String email) {
        return jpaRepository.findByEmail(email).map(UserEntity::toDomain);
    }

    /**
     * Recupera un usuario por su ID primario.
     */
    @Override
    public Optional<User> findById(Long id) {
        return jpaRepository.findById(id).map(UserEntity::toDomain);
    }

    /**
     * Obtiene todos los usuarios registrados en el sistema.
     */
    @Override
    public List<User> findAll() {
        return jpaRepository.findAll().stream()
                .map(UserEntity::toDomain)
                .collect(Collectors.toList());
    }

    /**
     * Persiste o actualiza un usuario en la base de datos.
     * 
     * @param user Modelo de dominio del usuario.
     * @return El usuario persistido convertido a dominio.
     */
    @Override
    public User save(User user) {
        UserEntity entity = UserEntity.fromDomain(user);
        return jpaRepository.save(entity).toDomain();
    }

    /**
     * Obtiene el catálogo completo de roles disponibles.
     */
    @Override
    public List<Role> findAllRoles() {
        return roleRepository.findAll().stream()
                .map(RoleEntity::toDomain)
                .collect(Collectors.toList());
    }

    /**
     * Busca un rol específico por su ID.
     */
    @Override
    public Optional<Role> findRoleById(Long id) {
        return roleRepository.findById(id).map(RoleEntity::toDomain);
    }
}

