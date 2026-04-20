package co.com.zenvory.inventario.pricelist.application.service;

import co.com.zenvory.inventario.pricelist.application.port.in.PriceListUseCase;
import co.com.zenvory.inventario.pricelist.application.port.out.PriceListRepositoryPort;
import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Servicio de aplicación que implementa la lógica de negocio para la gestión de listas de precios.
 * 
 * <p>Actúa como mediador entre los puertos de entrada y salida, asegurando la 
 * validación de parámetros y coordinando las operaciones de persistencia. 
 * Implementa la lógica de resolución de precios y actualización de catálogos 
 * diferenciados.</p>
 */
@Service
public class PriceListService implements PriceListUseCase {

    /** Puerto de salida para la persistencia de datos. */
    private final PriceListRepositoryPort repositoryPort;

    /**
     * Constructor con inyección de dependencias.
     * 
     * @param repositoryPort Adaptador de persistencia inyectado.
     */
    public PriceListService(PriceListRepositoryPort repositoryPort) {
        this.repositoryPort = repositoryPort;
    }


    @Override
    public List<PriceList> getAllActiveLists() {
        return repositoryPort.findAllActive();
    }

    @Override
    public Optional<BigDecimal> getPriceForProduct(Long listaId, Long productoId) {
        if (listaId == null) return Optional.empty();
        return repositoryPort.findByListaAndProducto(listaId, productoId)
                .map(ProductPrice::getPrecio);
    }

    @Override
    public List<ProductPrice> getPricesForList(Long listaId) {
        return repositoryPort.findByListaId(listaId);
    }

    @Override
    public ProductPrice upsertProductPrice(Long listaId, Long productoId, BigDecimal precio) {
        // Buscar si ya existe una entrada para este par (lista, producto)
        Optional<ProductPrice> existing = repositoryPort.findByListaAndProducto(listaId, productoId);
        ProductPrice toSave = existing
                .map(pp -> new ProductPrice(pp.getId(), listaId, productoId, precio))
                .orElse(new ProductPrice(null, listaId, productoId, precio));
        return repositoryPort.save(toSave);
    }

    @Override
    public void deleteProductPrice(Long listaId, Long productoId) {
        repositoryPort.deleteByListaAndProducto(listaId, productoId);
    }
}
