package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.pricelist.domain.model.ProductPrice;
import jakarta.persistence.*;
import java.math.BigDecimal;

@Entity
@Table(
    name = "precio_por_lista",
    uniqueConstraints = @UniqueConstraint(columnNames = {"lista_id", "producto_id"})
)
public class ProductPriceEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "lista_id", nullable = false)
    private Long listaId;

    @Column(name = "producto_id", nullable = false)
    private Long productoId;

    @Column(name = "precio", nullable = false, precision = 12, scale = 2)
    private BigDecimal precio;

    public ProductPriceEntity() {}

    public ProductPriceEntity(Long id, Long listaId, Long productoId, BigDecimal precio) {
        this.id = id;
        this.listaId = listaId;
        this.productoId = productoId;
        this.precio = precio;
    }

    public ProductPrice toDomain() {
        return new ProductPrice(id, listaId, productoId, precio);
    }

    public static ProductPriceEntity fromDomain(ProductPrice domain) {
        return new ProductPriceEntity(domain.getId(), domain.getListaId(), domain.getProductoId(), domain.getPrecio());
    }

    // Getters / Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getListaId() { return listaId; }
    public void setListaId(Long listaId) { this.listaId = listaId; }
    public Long getProductoId() { return productoId; }
    public void setProductoId(Long productoId) { this.productoId = productoId; }
    public BigDecimal getPrecio() { return precio; }
    public void setPrecio(BigDecimal precio) { this.precio = precio; }
}
