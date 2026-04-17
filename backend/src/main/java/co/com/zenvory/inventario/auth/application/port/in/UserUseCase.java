package co.com.zenvory.inventario.auth.application.port.in;

import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.auth.domain.model.Role;
import java.util.List;

public interface UserUseCase {
    List<User> getAllUsers();
    User getUserById(Long id);
    User createUser(User user, String plainPassword);
    User updateUser(Long id, User user, String plainPassword);
    void deactivateUser(Long id);
    List<Role> getAllRoles();
}
