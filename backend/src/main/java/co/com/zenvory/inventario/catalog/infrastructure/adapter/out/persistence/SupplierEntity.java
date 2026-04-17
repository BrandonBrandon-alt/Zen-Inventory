package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.Supplier;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad JPA que mapea la tabla {@code proveedor}.
 */
@Entity
@Table(name = "proveedor")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SupplierEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, length = 150)
    private String name;

    @Column(name = "contacto", length = 150)
    private String contact;

    @Column(name = "tiempo_entrega_dias")
    private Integer deliveryDays;

    public Supplier toDomain() {
        return Supplier.builder()
                .id(this.id)
                .name(this.name)
                .contact(this.contact)
                .deliveryDays(this.deliveryDays)
                .build();
    }

    public static SupplierEntity fromDomain(Supplier supplier) {
        return SupplierEntity.builder()
                .id(supplier.getId())
                .name(supplier.getName())
                .contact(supplier.getContact())
                .deliveryDays(supplier.getDeliveryDays())
                .build();
    }
}
