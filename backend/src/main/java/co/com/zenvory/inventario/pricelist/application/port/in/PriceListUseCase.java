package co.com.zenvory.inventario.pricelist.application.port.in;

import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de entrada (caso de uso) para la gestión de listas de precios.
 */
public interface PriceListUseCase {

    /** Devuelve todas las listas de precios activas. */
    List<PriceList> getAllActiveLists();

    /**
     * Resuelve el precio de un producto en una lista específica.
     * Si el producto no tiene precio configurado en esa lista, devuelve Optional.empty()
     * y el caller debe usar el precio base del producto como fallback.
     *
     * @param listaId    ID de la lista de precios
     * @param productoId ID del producto
     * @return Optional con el precio de la lista, o vacío si no se configuró
     */
    Optional<BigDecimal> getPriceForProduct(Long listaId, Long productoId);

    /**
     * Devuelve todos los precios configurados en una lista.
     * Útil para el módulo de administración.
     */
    List<ProductPrice> getPricesForList(Long listaId);

    /**
     * Crea o actualiza el precio de un producto en una lista.
     *
     * @param listaId    ID de la lista
     * @param productoId ID del producto
     * @param precio     Nuevo precio a establecer
     * @return El ProductPrice actualizado/creado
     */
    ProductPrice upsertProductPrice(Long listaId, Long productoId, BigDecimal precio);

    /**
     * Elimina el precio personalizado de un producto en una lista.
     * El sistema usará el precio base del producto como fallback.
     */
    void deleteProductPrice(Long listaId, Long productoId);
}
