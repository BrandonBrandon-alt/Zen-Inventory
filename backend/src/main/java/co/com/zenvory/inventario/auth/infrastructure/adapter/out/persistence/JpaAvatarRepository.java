package co.com.zenvory.inventario.auth.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaAvatarRepository extends JpaRepository<AvatarEntity, Long> {}
