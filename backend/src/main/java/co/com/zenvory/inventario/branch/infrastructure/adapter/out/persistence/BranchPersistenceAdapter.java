package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.branch.application.port.out.BranchRepositoryPort;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class BranchPersistenceAdapter implements BranchRepositoryPort {

    private final JpaBranchRepository jpaRepository;

    public BranchPersistenceAdapter(JpaBranchRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    @Override
    public List<Branch> findAll() {
        return jpaRepository.findAll().stream()
                .map(BranchEntity::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public Optional<Branch> findById(Long id) {
        return jpaRepository.findById(id)
                .map(BranchEntity::toDomain);
    }

    @Override
    public Branch save(Branch branch) {
        BranchEntity entity = BranchEntity.fromDomain(branch);
        return jpaRepository.save(entity).toDomain();
    }

    @Override
    public void deleteById(Long id) {
        if (id == null) throw new IllegalArgumentException("El ID de sucursal no puede ser nulo.");
        jpaRepository.deleteById(id);
    }
}