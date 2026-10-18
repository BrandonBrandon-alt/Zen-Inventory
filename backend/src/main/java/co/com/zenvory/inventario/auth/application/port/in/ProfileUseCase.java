package co.com.zenvory.inventario.auth.application.port.in;

import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import co.com.zenvory.inventario.auth.domain.model.User;
import java.util.Optional;

/**
 * Puerto de entrada para que cada persona gestione su propia cuenta (nombre, contraseña y foto).
 * Todas las operaciones actúan sobre quien las ejecuta ({@code actorEmail}); ninguna recibe un id de usuario.
 */
public interface ProfileUseCase {

    User getProfile(String actorEmail);

    User updateName(String actorEmail, String name);

    /**
     * @throws IllegalArgumentException Si la contraseña actual no coincide o la nueva es igual a la actual.
     */
    void changePassword(String actorEmail, String currentPassword, String newPassword);

    /**
     * Guarda la foto de perfil a partir de la imagen subida (se recorta a cuadrado y se reduce).
     *
     * @throws IllegalArgumentException Si el archivo no es una imagen válida.
     */
    User changeAvatar(String actorEmail, byte[] uploadedImage);

    User removeAvatar(String actorEmail);

    /** Foto de cualquier usuario (los nombres y fotos son visibles para todo el personal). */
    Optional<AvatarImage> getAvatar(Long userId);
}
