package co.com.zenvory.inventario.auth.application.service;

import co.com.zenvory.inventario.auth.application.port.in.ProfileUseCase;
import co.com.zenvory.inventario.auth.application.port.out.AvatarProcessorPort;
import co.com.zenvory.inventario.auth.application.port.out.AvatarRepositoryPort;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.exception.UnauthorizedActionException;
import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import co.com.zenvory.inventario.auth.domain.model.User;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

/** Servicio de aplicación del perfil propio: nombre, contraseña y foto. */
@Service
public class ProfileService implements ProfileUseCase {

    private final UserRepositoryPort users;
    private final AvatarRepositoryPort avatars;
    private final AvatarProcessorPort processor;
    private final PasswordEncoder passwordEncoder;

    public ProfileService(UserRepositoryPort users, AvatarRepositoryPort avatars,
                          AvatarProcessorPort processor, PasswordEncoder passwordEncoder) {
        this.users = users;
        this.avatars = avatars;
        this.processor = processor;
        this.passwordEncoder = passwordEncoder;
    }

    @Override
    public User getProfile(String actorEmail) {
        return actor(actorEmail);
    }

    @Override
    @Transactional
    public User updateName(String actorEmail, String name) {
        String trimmed = name == null ? "" : name.trim().replaceAll("\\s+", " ");
        if (trimmed.isEmpty()) {
            throw new IllegalArgumentException("El nombre es obligatorio.");
        }
        User user = actor(actorEmail);
        user.setNombre(trimmed);
        return users.save(user);
    }

    @Override
    @Transactional
    public void changePassword(String actorEmail, String currentPassword, String newPassword) {
        User user = actor(actorEmail);
        if (currentPassword == null || !passwordEncoder.matches(currentPassword, user.getPasswordHash())) {
            throw new IllegalArgumentException("La contraseña actual no es correcta.");
        }
        if (currentPassword.equals(newPassword)) {
            throw new IllegalArgumentException("La contraseña nueva debe ser distinta de la actual.");
        }
        user.setPasswordHash(passwordEncoder.encode(newPassword));
        users.save(user);
    }

    @Override
    @Transactional
    public User changeAvatar(String actorEmail, byte[] uploadedImage) {
        User user = actor(actorEmail);
        // Se procesa antes de tocar nada: una imagen inválida no deja la foto a medias.
        AvatarImage image = processor.process(uploadedImage);
        avatars.save(user.getId(), image);
        user.setAvatarUpdatedAt(LocalDateTime.now());
        return users.save(user);
    }

    @Override
    @Transactional
    public User removeAvatar(String actorEmail) {
        User user = actor(actorEmail);
        avatars.deleteByUserId(user.getId());
        user.setAvatarUpdatedAt(null);
        return users.save(user);
    }

    @Override
    public Optional<AvatarImage> getAvatar(Long userId) {
        return avatars.findByUserId(userId);
    }

    private User actor(String email) {
        User user = users.findByEmail(email)
                .orElseThrow(() -> new UnauthorizedActionException("No se pudo identificar al usuario autenticado."));
        if (Boolean.FALSE.equals(user.getActive())) {
            throw new UnauthorizedActionException("Su usuario está desactivado.");
        }
        return user;
    }
}
