package co.com.zenvory.inventario.pricelist.application.port.out;

import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;

import java.util.List;
import java.util.Optional;

/** Puerto de salida hacia la persistencia de listas de precios. */
public interface PriceListRepositoryPort {
    List<PriceList> findAllActive();
    Optional<ProductPrice> findByListaAndProducto(Long listaId, Long productoId);
    List<ProductPrice> findByListaId(Long listaId);
    ProductPrice save(ProductPrice productPrice);
    void deleteByListaAndProducto(Long listaId, Long productoId);
}
