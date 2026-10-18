package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.auth.application.port.out.AvatarRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.AvatarImage;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class AvatarPersistenceAdapter implements AvatarRepositoryPort {

    private final JpaAvatarRepository repository;

    public AvatarPersistenceAdapter(JpaAvatarRepository repository) {
        this.repository = repository;
    }

    @Override
    public Optional<AvatarImage> findByUserId(Long userId) {
        return repository.findById(userId).map(e -> new AvatarImage(e.getContent(), e.getContentType()));
    }

    @Override
    public void save(Long userId, AvatarImage image) {
        repository.save(new AvatarEntity(userId, image.content(), image.contentType()));
    }

    @Override
    public void deleteByUserId(Long userId) {
        repository.deleteById(userId);
    }
}
