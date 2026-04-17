package co.com.zenvory.inventario.branch.application.service;

import co.com.zenvory.inventario.branch.application.port.out.BranchRepositoryPort;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("BranchService — Tests unitarios")
class BranchServiceTest {

    @Mock
    private BranchRepositoryPort branchRepositoryPort;

    @InjectMocks
    private BranchService branchService;

    private Branch sampleBranch;

    @BeforeEach
    void setUp() {
        sampleBranch = Branch.builder()
                .id(1L)
                .name("Sucursal Norte")
                .address("Calle 123")
                .phone("3001234567")
                .active(true)
                .build();
    }

    // ─── getAllBranches ───────────────────────────────────────────────────────

    @Test
    @DisplayName("getAllBranches: retorna lista de sucursales del repositorio")
    void getAllBranches_returnsListFromRepository() {
        // Arrange
        when(branchRepositoryPort.findAll()).thenReturn(List.of(sampleBranch));

        // Act
        List<Branch> result = branchService.getAllBranches();

        // Assert
        assertThat(result).hasSize(1);
        assertThat(result.get(0).getName()).isEqualTo("Sucursal Norte");
        verify(branchRepositoryPort, times(1)).findAll();
    }

    @Test
    @DisplayName("getAllBranches: retorna lista vacía cuando no hay sucursales")
    void getAllBranches_returnsEmptyList() {
        // Arrange
        when(branchRepositoryPort.findAll()).thenReturn(List.of());

        // Act
        List<Branch> result = branchService.getAllBranches();

        // Assert
        assertThat(result).isEmpty();
    }

    // ─── getBranchById ───────────────────────────────────────────────────────

    @Test
    @DisplayName("getBranchById: retorna sucursal cuando el ID existe")
    void getBranchById_returnsBranch_whenFound() {
        // Arrange
        when(branchRepositoryPort.findById(1L)).thenReturn(Optional.of(sampleBranch));

        // Act
        Branch result = branchService.getBranchById(1L);

        // Assert
        assertThat(result).isNotNull();
        assertThat(result.getId()).isEqualTo(1L);
        assertThat(result.getName()).isEqualTo("Sucursal Norte");
    }

    @Test
    @DisplayName("getBranchById: lanza RuntimeException cuando el ID no existe")
    void getBranchById_throwsException_whenNotFound() {
        // Arrange
        when(branchRepositoryPort.findById(99L)).thenReturn(Optional.empty());

        // Act & Assert
        assertThatThrownBy(() -> branchService.getBranchById(99L))
                .isInstanceOf(RuntimeException.class)
                .hasMessageContaining("99");
    }

    // ─── createBranch ────────────────────────────────────────────────────────

    @Test
    @DisplayName("createBranch: guarda la sucursal con active=true y createdAt asignado")
    void createBranch_setsActiveTrueAndCreatedAt() {
        // Arrange
        Branch newBranch = Branch.builder()
                .name("Sucursal Sur")
                .address("Carrera 45")
                .phone("3009876543")
                .build();

        when(branchRepositoryPort.save(any(Branch.class))).thenAnswer(inv -> {
            Branch b = inv.getArgument(0);
            b.setId(2L);
            return b;
        });

        // Act
        Branch saved = branchService.createBranch(newBranch);

        // Assert
        assertThat(saved.getActive()).isTrue();
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getId()).isEqualTo(2L);
        verify(branchRepositoryPort, times(1)).save(any(Branch.class));
    }

    @Test
    @DisplayName("createBranch: llama al repositorio exactamente una vez")
    void createBranch_callsRepositoryOnce() {
        // Arrange
        Branch newBranch = Branch.builder().name("Test").build();
        when(branchRepositoryPort.save(any())).thenReturn(newBranch);

        // Act
        branchService.createBranch(newBranch);

        // Assert
        verify(branchRepositoryPort, times(1)).save(newBranch);
        verifyNoMoreInteractions(branchRepositoryPort);
    }
}
