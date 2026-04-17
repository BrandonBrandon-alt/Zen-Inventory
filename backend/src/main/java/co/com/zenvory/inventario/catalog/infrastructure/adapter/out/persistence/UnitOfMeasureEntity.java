package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad JPA que mapea la tabla {@code unidad_medida}.
 */
@Entity
@Table(name = "unidad_medida")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitOfMeasureEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "nombre", nullable = false, length = 50)
    private String name;

    @Column(name = "abreviatura", nullable = false, length = 10)
    private String abbreviation;

    public UnitOfMeasure toDomain() {
        return UnitOfMeasure.builder()
                .id(this.id)
                .name(this.name)
                .abbreviation(this.abbreviation)
                .build();
    }

    public static UnitOfMeasureEntity fromDomain(UnitOfMeasure unit) {
        return UnitOfMeasureEntity.builder()
                .id(unit.getId())
                .name(unit.getName())
                .abbreviation(unit.getAbbreviation())
                .build();
    }
}
