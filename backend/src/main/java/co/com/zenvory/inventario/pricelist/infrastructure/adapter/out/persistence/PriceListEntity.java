package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import jakarta.persistence.*;

@Entity
@Table(name = "lista_precios")
public class PriceListEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, unique = true, length = 100)
    private String nombre;

    @Column(name = "descripcion", length = 255)
    private String descripcion;

    @Column(name = "activa", nullable = false)
    private boolean activa = true;

    public PriceListEntity() {}

    public PriceList toDomain() {
        return new PriceList(id, nombre, descripcion, activa);
    }

    // Getters
    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public String getDescripcion() { return descripcion; }
    public boolean isActiva() { return activa; }
}
