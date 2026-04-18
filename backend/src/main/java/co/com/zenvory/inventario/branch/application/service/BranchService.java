package co.com.zenvory.inventario.branch.application.service;

import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.application.port.out.BranchRepositoryPort;
import co.com.zenvory.inventario.branch.domain.exception.BranchNotFoundException;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class BranchService implements BranchUseCase {

    private final BranchRepositoryPort branchRepositoryPort;

    public BranchService(BranchRepositoryPort branchRepositoryPort) {
        this.branchRepositoryPort = branchRepositoryPort;
    }

    @Override
    public List<Branch> getAllBranches() {
        return branchRepositoryPort.findAll();
    }

    @Override
    public Branch getBranchById(Long id) {
        return branchRepositoryPort.findById(id)
                .orElseThrow(() -> new BranchNotFoundException(id));
    }

    @Override
    public Branch createBranch(Branch branch) {
        branch.setActive(true);
        branch.setCreatedAt(LocalDateTime.now());
        return branchRepositoryPort.save(branch);
    }

    @Override
    public Branch updateBranch(Long id, Branch updated) {
        Branch existing = branchRepositoryPort.findById(id)
                .orElseThrow(() -> new BranchNotFoundException(id));

        existing.setName(updated.getName());
        existing.setAddress(updated.getAddress());
        existing.setPhone(updated.getPhone());
        existing.setManagerId(updated.getManagerId());
        if (updated.getActive() != null) {
            existing.setActive(updated.getActive());
        }

        return branchRepositoryPort.save(existing);
    }

    @Override
    public void deleteBranch(Long id) {
        // Soft-delete: se desactiva la sucursal en lugar de borrarla físicamente
        // para preservar la integridad referencial con inventario, ventas y traslados.
        Branch existing = branchRepositoryPort.findById(id)
                .orElseThrow(() -> new BranchNotFoundException(id));
        existing.setActive(false);
        branchRepositoryPort.save(existing);
    }
}