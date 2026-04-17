package co.com.zenvory.inventario.branch.application.port.in;

import co.com.zenvory.inventario.branch.domain.model.Branch;
import java.util.List;

public interface BranchUseCase {
    List<Branch> getAllBranches();

    Branch getBranchById(Long id);

    Branch createBranch(Branch branch);

    Branch updateBranch(Long id, Branch branch);

    void deleteBranch(Long id);
}