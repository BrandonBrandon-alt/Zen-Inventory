package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.pricelist.application.port.out.PriceListRepositoryPort;
import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class PriceListPersistenceAdapter implements PriceListRepositoryPort {

    private final JpaPriceListRepository priceListRepo;
    private final JpaProductPriceRepository productPriceRepo;

    public PriceListPersistenceAdapter(JpaPriceListRepository priceListRepo,
                                       JpaProductPriceRepository productPriceRepo) {
        this.priceListRepo = priceListRepo;
        this.productPriceRepo = productPriceRepo;
    }

    @Override
    public List<PriceList> findAllActive() {
        return priceListRepo.findByActivaTrue().stream()
                .map(PriceListEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<ProductPrice> findByListaAndProducto(Long listaId, Long productoId) {
        return productPriceRepo.findByListaIdAndProductoId(listaId, productoId)
                .map(ProductPriceEntity::toDomain);
    }

    @Override
    public List<ProductPrice> findByListaId(Long listaId) {
        return productPriceRepo.findByListaId(listaId).stream()
                .map(ProductPriceEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public ProductPrice save(ProductPrice productPrice) {
        ProductPriceEntity entity = ProductPriceEntity.fromDomain(productPrice);
        ProductPriceEntity saved = productPriceRepo.save(entity);
        if (saved == null) throw new IllegalStateException("Error al guardar precio: el repositorio retornó null");
        return saved.toDomain();
    }

    @Override
    @Transactional
    public void deleteByListaAndProducto(Long listaId, Long productoId) {
        productPriceRepo.deleteByListaIdAndProductoId(listaId, productoId);
    }
}
