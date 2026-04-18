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

@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchUseCase branchUseCase;

    public BranchController(BranchUseCase branchUseCase) {
        this.branchUseCase = branchUseCase;
    }

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

    @GetMapping
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER')")
    public ResponseEntity<List<BranchResponse>> getAll() {
        List<BranchResponse> response = branchUseCase.getAllBranches().stream()
                .map(this::mapToResponse)
                .collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }

    @GetMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasAnyRole('ADMIN', 'MANAGER', 'SELLER')")
    public ResponseEntity<BranchResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(mapToResponse(branchUseCase.getBranchById(id)));
    }

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

    @DeleteMapping("/{id}")
    @org.springframework.security.access.prepost.PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        branchUseCase.deleteBranch(id);
        return ResponseEntity.noContent().build();
    }

    // Método helper para no repetir código de mapeo
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