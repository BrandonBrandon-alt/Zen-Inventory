package co.com.zenvory.inventario.catalog.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.catalog.domain.model.UnitOfMeasure;
import jakarta.persistence.*;
import lombok.*;

/**
 * Entidad JPA que representa la tabla {@code unidad_medida} en el esquema de base de datos.
 * 
 * <p>Define las magnitudes físicas estándar para la gestión de existencias. 
 * Actúa como un catálogo maestro global referenciado por múltiples módulos.</p>
 */
@Entity
@Table(name = "unidad_medida")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UnitOfMeasureEntity {

    /** Identificador único autoincremental del nomenclador. */
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Nombre descriptivo (e.g., "Kilogramo", "Litro"). */
    @Column(name = "nombre", nullable = false, length = 50)
    private String name;

    /** Símbolo o abreviatura técnica (e.g., "kg", "L"). */
    @Column(name = "abreviatura", nullable = false, length = 10)
    private String abbreviation;

    /** 
     * Convierte la entidad de infraestructura al modelo de dominio {@link UnitOfMeasure}. 
     * 
     * @return Instancia del dominio.
     */
    public UnitOfMeasure toDomain() {
        return UnitOfMeasure.builder()
                .id(this.id)
                .name(this.name)
                .abbreviation(this.abbreviation)
                .build();
    }

    /** 
     * Crea una instancia de esta entidad JPA a partir de un objeto de dominio.
     * 
     * @param unit Modelo de dominio de origen.
     * @return Entidad preparada para persistencia.
     */
    public static UnitOfMeasureEntity fromDomain(UnitOfMeasure unit) {
        return UnitOfMeasureEntity.builder()
                .id(unit.getId())
                .name(unit.getName())
                .abbreviation(unit.getAbbreviation())
                .build();
    }
}

