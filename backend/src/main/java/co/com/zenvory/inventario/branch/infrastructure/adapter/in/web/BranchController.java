package co.com.zenvory.inventario.branch.infrastructure.adapter.in.web;

import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto.BranchRequest;
import co.com.zenvory.inventario.branch.infrastructure.adapter.in.web.dto.BranchResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.validation.Valid;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Adaptador de entrada (Primary Adapter) para la gestión de sucursales.
 * 
 * <p>Proporciona los endpoints REST para realizar operaciones CRUD sobre las sedes 
 * físicas del negocio. Implementa restricciones de seguridad basadas en roles para
 * asegurar que solo personal autorizado pueda modificar la estructura organizacional.</p>
 */
@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchUseCase branchUseCase;

    /**
     * Constructor para inyección de dependencias.
     * @param branchUseCase Puerto de entrada para la lógica de negocio de sucursales.
     */
    public BranchController(BranchUseCase branchUseCase) {
        this.branchUseCase = branchUseCase;
    }

    /**
     * Registra una nueva sucursal en el sistema.
     * 
     * @param request Datos de la sucursal a crear.
     * @return La sucursal creada con su ID asignado.
     * @status 201 Created si el registro es exitoso.
     */
    @PostMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BranchResponse> create(@Valid @RequestBody BranchRequest request) {
        // 1. Mapear DTO a Dominio
        Branch branchToCreate = Branch.builder()
                .name(request.nombre())
                .address(request.direccion())
                .phone(request.telefono())
                .managerId(request.managerId())
                .build();

        // 2. Ejecutar caso de uso
        Branch savedBranch = branchUseCase.createBranch(branchToCreate);

        // 3. Mapear Dominio a DTO
        return ResponseEntity.status(HttpStatus.CREATED).body(mapToResponse(savedBranch));
    }

    /**
     * Recupera el listado completo de sucursales activas.
     * 
     * @return Lista de sucursales autorizadas para la visualización del usuario.
     */
    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<List<BranchResponse>> getAll() {
        List<BranchResponse> response = branchUseCase.getAllBranches().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    /**
     * Obtiene los detalles de una sucursal específica por su ID.
     * 
     * @param id Identificador de la sucursal.
     * @return Datos de la sucursal solicitada.
     */
    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')")
    public ResponseEntity<BranchResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(branchUseCase.getBranchById(id)));
    }

    /**
     * Actualiza la información de contacto o administrativa de una sucursal.
     * 
     * @param id ID de la sucursal a modificar.
     * @param request Nuevos datos de la sucursal.
     * @return La sucursal con los cambios aplicados.
     */
    @PutMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<BranchResponse> update(
            @PathVariable Long id,
            @Valid @RequestBody BranchRequest request) {

        Branch branchData = Branch.builder()
                .name(request.nombre())
                .address(request.direccion())
                .phone(request.telefono())
                .managerId(request.managerId())
                .build();

        Branch updated = branchUseCase.updateBranch(id, branchData);
        return ResponseEntity.ok(mapToResponse(updated));
    }

    /**
     * Desactiva una sucursal del sistema (eliminación lógica).
     * 
     * @param id ID de la sucursal a retirar del catálogo activo.
     * @return Respuesta sin contenido confirmando la deshabilitación.
     */
    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        branchUseCase.deleteBranch(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Método helper para transformar el modelo de dominio a DTO de respuesta.
     */
    private BranchResponse mapToResponse(Branch branch) {
        return BranchResponse.builder()
                .id(branch.getId())
                .nombre(branch.getName())
                .direccion(branch.getAddress())
                .telefono(branch.getPhone())
                .activa(branch.getActive())
                .managerId(branch.getManagerId())
                .build();
    }
}