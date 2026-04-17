package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface JpaProductPriceRepository extends JpaRepository<ProductPriceEntity, Long> {
    Optional<ProductPriceEntity> findByListaIdAndProductoId(Long listaId, Long productoId);
    List<ProductPriceEntity> findByListaId(Long listaId);
    void deleteByListaIdAndProductoId(Long listaId, Long productoId);
}
