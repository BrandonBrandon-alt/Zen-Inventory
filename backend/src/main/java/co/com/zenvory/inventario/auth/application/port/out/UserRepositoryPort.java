package co.com.zenvory.inventario.auth.application.port.out;

import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import java.util.List;
import java.util.Optional;

public interface UserRepositoryPort {
    Optional<User> findByEmail(String email);
    Optional<User> findById(Long id);
    List<User> findAll();
    User save(User user);
    List<Role> findAllRoles();
    Optional<Role> findRoleById(Long id);
}
