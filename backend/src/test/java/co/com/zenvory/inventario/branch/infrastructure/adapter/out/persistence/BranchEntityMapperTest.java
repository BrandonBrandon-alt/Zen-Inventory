package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.branch.domain.model.Branch;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("BranchEntity — Tests de mapeo Domain ↔ Entity")
class BranchEntityMapperTest {

    private static final LocalDateTime FIXED_DATE = LocalDateTime.of(2024, 1, 15, 10, 30);

    // ─── toDomain ────────────────────────────────────────────────────────────

    @Test
    @DisplayName("toDomain: convierte todos los campos correctamente a Branch de dominio")
    void toDomain_mapsAllFieldsCorrectly() {
        // Arrange
        BranchEntity entity = BranchEntity.builder()
                .id(1L)
                .name("Sucursal Centro")
                .address("Av. Siempre Viva 742")
                .phone("6011234567")
                .active(true)
                .createdAt(FIXED_DATE)
                .build();

        // Act
        Branch domain = entity.toDomain();

        // Assert
        assertThat(domain.getId()).isEqualTo(1L);
        assertThat(domain.getName()).isEqualTo("Sucursal Centro");
        assertThat(domain.getAddress()).isEqualTo("Av. Siempre Viva 742");
        assertThat(domain.getPhone()).isEqualTo("6011234567");
        assertThat(domain.getActive()).isTrue();
        assertThat(domain.getCreatedAt()).isEqualTo(FIXED_DATE);
    }

    @Test
    @DisplayName("toDomain: maneja campos nulos sin lanzar excepción")
    void toDomain_handlesNullFieldsGracefully() {
        // Arrange
        BranchEntity entity = BranchEntity.builder()
                .id(2L)
                .name("Sucursal Mínima")
                .build();

        // Act
        Branch domain = entity.toDomain();

        // Assert
        assertThat(domain.getId()).isEqualTo(2L);
        assertThat(domain.getName()).isEqualTo("Sucursal Mínima");
        assertThat(domain.getAddress()).isNull();
        assertThat(domain.getPhone()).isNull();
        assertThat(domain.getCreatedAt()).isNull();
    }

    // ─── fromDomain ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("fromDomain: convierte todos los campos correctamente a BranchEntity")
    void fromDomain_mapsAllFieldsCorrectly() {
        // Arrange
        Branch domain = Branch.builder()
                .id(3L)
                .name("Sucursal Occidente")
                .address("Calle 80 # 68-10")
                .phone("3124567890")
                .active(false)
                .createdAt(FIXED_DATE)
                .build();

        // Act
        BranchEntity entity = BranchEntity.fromDomain(domain);

        // Assert
        assertThat(entity.getId()).isEqualTo(3L);
        assertThat(entity.getName()).isEqualTo("Sucursal Occidente");
        assertThat(entity.getAddress()).isEqualTo("Calle 80 # 68-10");
        assertThat(entity.getPhone()).isEqualTo("3124567890");
        assertThat(entity.getActive()).isFalse();
        assertThat(entity.getCreatedAt()).isEqualTo(FIXED_DATE);
    }

    @Test
    @DisplayName("fromDomain → toDomain: ida y vuelta conserva todos los datos")
    void roundTrip_preservesAllData() {
        // Arrange
        Branch original = Branch.builder()
                .id(4L)
                .name("Sucursal Norte")
                .address("Carrera 15 # 90-45")
                .phone("3209876543")
                .active(true)
                .createdAt(FIXED_DATE)
                .build();

        // Act — Domain → Entity → Domain
        Branch result = BranchEntity.fromDomain(original).toDomain();

        // Assert
        assertThat(result.getId()).isEqualTo(original.getId());
        assertThat(result.getName()).isEqualTo(original.getName());
        assertThat(result.getAddress()).isEqualTo(original.getAddress());
        assertThat(result.getPhone()).isEqualTo(original.getPhone());
        assertThat(result.getActive()).isEqualTo(original.getActive());
        assertThat(result.getCreatedAt()).isEqualTo(original.getCreatedAt());
    }
}
