package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.pricelist.domain.model.PriceList;
import jakarta.persistence.*;

/**
 * Entidad JPA que representa la tabla "lista_precios".
 * 
 * <p>Mapea las categorías de precios configurables en la base de datos relacional. 
 * Permite persistir los nombres y estados de las listas que agrupan los valores 
 * comerciales de los productos.</p>
 */
@Entity
@Table(name = "lista_precios")
public class PriceListEntity {

    /** Identificador único autoincremental en base de datos. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre único de la lista (e.g., "MINORISTA"). */
    @Column(name = "nombre", nullable = false, unique = true, length = 100)
    private String nombre;

    /** Aclaraciones sobre el uso de la lista. */
    @Column(name = "descripcion", length = 255)
    private String descripcion;

    /** Indica si la lista está disponible para nuevas operaciones. */
    @Column(name = "activa", nullable = false)
    private boolean activa = true;

    /** Constructor por defecto requerido por JPA. */
    public PriceListEntity() {}

    /**
     * Convierte la entidad de persistencia al modelo de dominio.
     * 
     * @return Instancia de {@link PriceList}.
     */
    public PriceList toDomain() {
        return new PriceList(id, nombre, descripcion, activa);
    }

    /** @return Identificador único. */
    public Long getId() { return id; }
    
    /** @return Nombre comercial. */
    public String getNombre() { return nombre; }
    
    /** @return Descripción de la lista. */
    public String getDescripcion() { return descripcion; }
    
    /** @return true si está activa. */
    public boolean isActiva() { return activa; }
}

