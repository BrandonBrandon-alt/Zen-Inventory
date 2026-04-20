package co.com.zenvory.inventario.pricelist.application.port.out;

import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;

import java.util.List;
import java.util.Optional;

/**
 * Puerto de salida (Output Port) para la persistencia de listas de precios y sus valores.
 * 
 * <p>Define el contrato para el almacenamiento y recuperación de definiciones de precios. 
 * Desacopla la lógica de negocio de la implementación tecnológica específica del 
 * motor de base de datos.</p>
 */
public interface PriceListRepositoryPort {

    /**
     * Recupera todas las listas de precios habilitadas.
     * 
     * @return Lista de {@link PriceList}.
     */
    List<PriceList> findAllActive();

    /**
     * Busca la definición de precio para un par producto-lista.
     * 
     * @param listaId    Identificador de la lista.
     * @param productoId Identificador del producto.
     * @return {@link Optional} con el registro de precio si existe.
     */
    Optional<ProductPrice> findByListaAndProducto(Long listaId, Long productoId);

    /**
     * Obtiene todos los precios asociados a una lista de precios.
     * 
     * @param listaId Identificador de la lista.
     * @return Lista de registros {@link ProductPrice}.
     */
    List<ProductPrice> findByListaId(Long listaId);

    /**
     * Persiste o actualiza un registro de precio.
     * 
     * @param productPrice Modelo de dominio a guardar.
     * @return El registro persistido.
     */
    ProductPrice save(ProductPrice productPrice);

    /**
     * Elimina el registro de precio para un producto en una lista específica.
     * 
     * @param listaId    Identificador de la lista.
     * @param productoId Identificador del producto.
     */
    void deleteByListaAndProducto(Long listaId, Long productoId);
}

