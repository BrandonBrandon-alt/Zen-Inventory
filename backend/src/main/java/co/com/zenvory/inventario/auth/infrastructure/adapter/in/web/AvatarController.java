package co.com.zenvory.inventario.auth.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.auth.application.port.in.ProfileUseCase;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Duration;

/**
 * Fotos de perfil. Las puede pedir cualquier usuario autenticado (los nombres y fotos del personal se ven en toda
 * la aplicación). El cliente las pide con {@code ?v=<avatarActualizadoEn>}, por eso el caché puede ser largo: al
 * cambiar la foto cambia la URL.
 */
@RestController
@RequestMapping("/api/avatars")
public class AvatarController {

    private final ProfileUseCase profile;

    public AvatarController(ProfileUseCase profile) {
        this.profile = profile;
    }

    @GetMapping("/{userId}")
    public ResponseEntity<byte[]> get(@PathVariable Long userId) {
        return profile.getAvatar(userId)
                .map(image -> ResponseEntity.ok()
                        .contentType(MediaType.parseMediaType(image.contentType()))
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(30)).cachePrivate())
                        .header("X-Content-Type-Options", "nosniff")
                        .body(image.content()))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
