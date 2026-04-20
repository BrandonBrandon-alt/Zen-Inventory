package co.com.zenvory.inventario.branch.application.service;

import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.application.port.out.BranchRepositoryPort;
import co.com.zenvory.inventario.branch.domain.exception.BranchNotFoundException;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicación que implementa la lógica de negocio para la gestión de sucursales.
 * 
 * <p>Coordina las operaciones de orquestación de datos de sucursales, incluyendo 
 * el manejo de fechas de creación y la implementación de borrados lógicos.</p>
 */
@Service
public class BranchService implements BranchUseCase {

    private final BranchRepositoryPort branchRepositoryPort;

    /**
     * Constructor para inyección de dependencias.
     * @param branchRepositoryPort Puerto de salida para persistencia.
     */
    public BranchService(BranchRepositoryPort branchRepositoryPort) {
        this.branchRepositoryPort = branchRepositoryPort;
    }

    /** {@inheritDoc} */
    @Override
    public List<Branch> getAllBranches() {
        return branchRepositoryPort.findAll();
    }

    /** 
     * {@inheritDoc} 
     * @throws BranchNotFoundException Si el ID no existe en el sistema.
     */
    @Override
    public Branch getBranchById(Long id) {
        return branchRepositoryPort.findById(id)
                .orElseThrow(() -> new BranchNotFoundException(id));
    }

    /** 
     * {@inheritDoc} 
     * <p>Inicializa la sucursal como activa y establece la fecha de registro actual.</p>
     */
    @Override
    public Branch createBranch(Branch branch) {
        branch.setActive(true);
        branch.setCreatedAt(LocalDateTime.now());
        return branchRepositoryPort.save(branch);
    }

    /** {@inheritDoc} */
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

    /** 
     * {@inheritDoc} 
     * <p>Implementa un borrado lógico (soft-delete) marcando la sucursal como inactiva.
     * Esto es crítico para preservar la integridad referencial con el historial de
     * ventas, inventarios y traslados.</p>
     */
    @Override
    public void deleteBranch(Long id) {
        Branch existing = branchRepositoryPort.findById(id)
                .orElseThrow(() -> new BranchNotFoundException(id));
        existing.setActive(false);
        branchRepositoryPort.save(existing);
    }
}