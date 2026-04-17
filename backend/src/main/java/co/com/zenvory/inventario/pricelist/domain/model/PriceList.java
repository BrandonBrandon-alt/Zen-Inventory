package co.com.zenvory.inventario.pricelist.domain.model;

/**
 * Modelo de dominio que representa una Lista de Precios configurable.
 * Ejemplos: "Minorista", "Mayorista", "Especial".
 */
public class PriceList {
    private Long id;
    private String nombre;
    private String descripcion;
    private boolean activa;

    public PriceList(Long id, String nombre, String descripcion, boolean activa) {
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.activa = activa;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public String getDescripcion() { return descripcion; }
    public boolean isActiva() { return activa; }
}
