package co.com.zenvory.inventario.pricelist.application.port.in;

import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

/**
 * Puerto de entrada (Input Port) que define los casos de uso para la gestión de listas de precios.
 * 
 * <p>Esta interfaz actúa como el contrato principal para que los adaptadores de entrada 
 * (Controladores REST, Tareas Programadas) interactúen con la lógica de negocio de 
 * precios diferenciados. Maneja la resolución de precios, la administración de 
 * catálogos por lista y las operaciones de actualización (upsert).</p>
 */
public interface PriceListUseCase {

    /**
     * Recupera todas las listas de precios marcadas como activas en el sistema.
     * 
     * @return Lista de {@link PriceList}.
     */
    List<PriceList> getAllActiveLists();

    /**
     * Resuelve el valor monetario asignado a un producto dentro de un contexto de lista específico.
     * 
     * <p>Si el producto no posee un registro explícito en la lista solicitada, el sistema 
     * devuelve un {@link Optional#empty()}. En tales casos, se espera que el componente 
     * solicitante aplique el precio base definido en el registro maestro del producto 
     * (Estrategia de Fallback).</p>
     *
     * @param listaId    Identificador de la lista de precios.
     * @param productoId Identificador del producto a consultar.
     * @return {@link Optional} con el valor del precio, o vacío si no hay configuración específica.
     */
    Optional<BigDecimal> getPriceForProduct(Long listaId, Long productoId);

    /**
     * Obtiene el desglose completo de precios configurados para una lista determinada.
     * 
     * <p>Utilizado principalmente por el módulo administrativo para la gestión de 
     * catálogos mayoristas o promocionales.</p>
     * 
     * @param listaId Identificador de la lista.
     * @return Lista de registros {@link ProductPrice}.
     */
    List<ProductPrice> getPricesForList(Long listaId);

    /**
     * Registra o actualiza el valor comercial de un artículo en una lista de precios.
     * 
     * <p>Si el vínculo (Lista, Producto) no existe, se crea uno nuevo; de lo contrario, 
     * se sobrescribe el valor previo.</p>
     *
     * @param listaId    Identificador de la lista.
     * @param productoId Identificador del producto.
     * @param precio     Nuevo valor monetario a establecer.
     * @return El objeto {@link ProductPrice} persistido.
     */
    ProductPrice upsertProductPrice(Long listaId, Long productoId, BigDecimal precio);

    /**
     * Remueve la configuración de precio personalizado para un producto en una lista.
     * 
     * <p>Tras la eliminación, cualquier consulta futura sobre este par (Lista, Producto) 
     * disparará la lógica de fallback hacia el precio base del producto.</p>
     * 
     * @param listaId    Identificador de la lista.
     * @param productoId Identificador del producto.
     */
    void deleteProductPrice(Long listaId, Long productoId);
}

