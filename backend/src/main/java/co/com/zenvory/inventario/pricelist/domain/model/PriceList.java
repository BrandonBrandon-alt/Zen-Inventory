package co.com.zenvory.inventario.pricelist.domain.model;

/**
 * Modelo de dominio que representa una Lista de Precios configurable.
 * 
 * <p>Permite agrupar definiciones de precios para diferentes perfiles de clientes 
 * o tipos de negocio (e.g., "Minorista", "Mayorista", "Especial"). 
 * Sirve como base para la estrategia de precios diferenciados en el sistema.</p>
 */
public class PriceList {
    /** Identificador único de la lista de precios. */
    private Long id;
    
    /** Nombre descriptivo de la lista (e.g., "Precios Distribuidor"). */
    private String nombre;
    
    /** Detalle adicional sobre la aplicación de la lista. */
    private String descripcion;
    
    /** Estado de habilitación para su uso en transacciones comerciales. */
    private boolean activa;

    /**
     * Constructor para inicialización completa de la lista de precios.
     * 
     * @param id Identificador único.
     * @param nombre Nombre de la lista.
     * @param descripcion Descripción de la lista.
     * @param activa Estado inicial de actividad.
     */
    public PriceList(Long id, String nombre, String descripcion, boolean activa) {
        this.id = id;
        this.nombre = nombre;
        this.descripcion = descripcion;
        this.activa = activa;
    }

    /** @return Identificador único. */
    public Long getId() { return id; }
    
    /** @return Nombre descriptivo. */
    public String getNombre() { return nombre; }
    
    /** @return Descripción detallada. */
    public String getDescripcion() { return descripcion; }
    
    /** @return true si la lista está disponible para su uso. */
    public boolean isActiva() { return activa; }
}

