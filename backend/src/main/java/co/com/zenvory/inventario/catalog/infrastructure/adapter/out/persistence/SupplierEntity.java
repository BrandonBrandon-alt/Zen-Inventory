package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad JPA que representa la tabla {@code proveedor} en el esquema de base de datos.
 * 
 * <p>Almacena los datos maestros de las entidades externas que abastecen el catálogo 
 * de productos. Incluye mappers para la conversión con el modelo de dominio.</p>
 */
@Entity
@Table(name = "proveedor")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierEntity {

    /** Identificador único autoincremental. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre comercial o razón social registrado. */
    @Column(name = "nombre", nullable = false, length = 150)
    private String name;

    /** Información de contacto (e.g., email, teléfono o persona encargada). */
    @Column(name = "contacto", length = 150)
    private String contact;

    /** Tiempo estimado de entrega en días calendario. */
    @Column(name = "tiempo_entrega_dias")
    private Integer deliveryDays;

    /** 
     * Convierte la entidad de persistencia al modelo de dominio {@link Supplier}. 
     * 
     * @return Instancia del dominio.
     */
    public Supplier toDomain() {
        return Supplier.builder()
                .id(this.id)
                .name(this.name)
                .contact(this.contact)
                .deliveryDays(this.deliveryDays)
                .build();
    }

    /** 
     * Crea una entidad JPA a partir de un objeto de dominio.
     * 
     * @param supplier Modelo de dominio de origen.
     * @return Entidad preparada para persistencia.
     */
    public static SupplierEntity fromDomain(Supplier supplier) {
        return SupplierEntity.builder()
                .id(supplier.getId())
                .name(supplier.getName())
                .contact(supplier.getContact())
                .deliveryDays(supplier.getDeliveryDays())
                .build();
    }
}

