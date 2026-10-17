package co.com.zenvory.inventario.auth.application.port.out;

import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import java.util.Optional;

/** Puerto de salida para guardar las fotos de perfil, una por usuario. */
public interface AvatarRepositoryPort {

    Optional<AvatarImage> findByUserId(Long userId);

    /** Guarda la foto del usuario, reemplazando la anterior si la había. */
    void save(Long userId, AvatarImage image);

    void deleteByUserId(Long userId);
}
