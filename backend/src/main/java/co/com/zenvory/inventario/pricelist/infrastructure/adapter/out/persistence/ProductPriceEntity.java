package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;
import jakarta.persistence.*;
import java.math.BigDecimal;

/**
 * Entidad JPA que representa la tabla "precio_por_lista".
 * 
 * <p>Mapea el vínculo específico entre una lista de precios y un producto. 
 * Mantiene una restricción de unicidad para la combinación (lista, producto), 
 * asegurando que un artículo tenga un único precio definido por cada lista.</p>
 */
@Entity
@Table(
    name = "precio_por_lista",
    uniqueConstraints = @UniqueConstraint(columnNames = {"lista_id", "producto_id"})
)
public class ProductPriceEntity {

    /** Identificador único autoincremental del registro de precio. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** ID de la lista de precios contenedora. */
    @Column(name = "lista_id", nullable = false)
    private Long listaId;

    /** ID del producto vinculado. */
    @Column(name = "producto_id", nullable = false)
    private Long productoId;

    /** Valor monetario asignado. */
    @Column(name = "precio", nullable = false, precision = 12, scale = 2)
    private BigDecimal precio;

    /** Constructor por defecto requerido por JPA. */
    public ProductPriceEntity() {}

    /**
     * Constructor con parámetros para inicialización completa.
     * 
     * @param id Identificador único.
     * @param listaId ID de la lista.
     * @param productoId ID del producto.
     * @param precio Valor del precio.
     */
    public ProductPriceEntity(Long id, Long listaId, Long productoId, BigDecimal precio) {
        this.id = id;
        this.listaId = listaId;
        this.productoId = productoId;
        this.precio = precio;
    }

    /**
     * Convierte la entidad de persistencia al modelo de dominio.
     * 
     * @return Instancia de {@link ProductPrice}.
     */
    public ProductPrice toDomain() {
        return new ProductPrice(id, listaId, productoId, precio);
    }

    /**
     * Crea una entidad JPA a partir del modelo de dominio.
     * 
     * @param domain Modelo de dominio del precio de producto.
     * @return Entidad JPA mapeada.
     */
    public static ProductPriceEntity fromDomain(ProductPrice domain) {
        return new ProductPriceEntity(domain.getId(), domain.getListaId(), domain.getProductoId(), domain.getPrecio());
    }

    /** @return Identificador único. */
    public Long getId() { return id; }
    
    /** @param id Nuevo identificador. */
    public void setId(Long id) { this.id = id; }
    
    /** @return ID de la lista asociada. */
    public Long getListaId() { return listaId; }
    
    /** @param listaId Nuevo ID de lista. */
    public void setListaId(Long listaId) { this.listaId = listaId; }
    
    /** @return ID del producto asociado. */
    public Long getProductoId() { return productoId; }
    
    /** @param productoId Nuevo ID de producto. */
    public void setProductoId(Long productoId) { this.productoId = productoId; }
    
    /** @return Valor del precio actual. */
    public BigDecimal getPrecio() { return precio; }
    
    /** @param precio Nuevo valor monetario. */
    public void setPrecio(BigDecimal precio) { this.precio = precio; }
}

