package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.UserUseCase;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.UserNotFoundException;
import co.com.zenvory.inventario.auth.domain.model.Role;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class UserService implements UserUseCase {

    private final UserRepositoryPort userRepositoryPort;
    private final PasswordEncoder passwordEncoder;

    public UserService(UserRepositoryPort userRepositoryPort, PasswordEncoder passwordEncoder) {
        this.userRepositoryPort = userRepositoryPort;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public List<User> getAllUsers() {
        return userRepositoryPort.findAll();
    }

    @Override
    public User getUserById(Long id) {
        return userRepositoryPort.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
    }

    @Override
    public User createUser(User user, String plainPassword) {
        user.setPasswordHash(passwordEncoder.encode(plainPassword));
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());
        
        // Cargar el rol completo desde el puerto de salida para asegurar consistencia
        Role role = userRepositoryPort.findRoleById(user.getRole().getId())
                .orElseThrow(() -> new RuntimeException("Rol no encontrado: " + user.getRole().getId()));
        user.setRole(role);
        
        return userRepositoryPort.save(user);
    }

    @Override
    public User updateUser(Long id, User updated, String plainPassword) {
        User existing = userRepositoryPort.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));

        existing.setNombre(updated.getNombre());
        existing.setEmail(updated.getEmail());
        existing.setSucursalId(updated.getSucursalId());
        
        if (updated.getRole() != null && updated.getRole().getId() != null) {
            Role role = userRepositoryPort.findRoleById(updated.getRole().getId())
                    .orElseThrow(() -> new RuntimeException("Rol no encontrado"));
            existing.setRole(role);
        }

        if (plainPassword != null && !plainPassword.isBlank()) {
            existing.setPasswordHash(passwordEncoder.encode(plainPassword));
        }

        if (updated.getActive() != null) {
            existing.setActive(updated.getActive());
        }

        return userRepositoryPort.save(existing);
    }

    @Override
    public void deactivateUser(Long id) {
        User existing = userRepositoryPort.findById(id)
                .orElseThrow(() -> new UserNotFoundException(id));
        existing.setActive(false);
        userRepositoryPort.save(existing);
    }

    @Override
    public List<Role> getAllRoles() {
        return userRepositoryPort.findAllRoles();
    }
}
