package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.branch.application.port.out.BranchRepositoryPort;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Adaptador de salida (Secondary Adapter) para la persistencia de sucursales.
 * 
 * <p>Implementa la interfaz {@link BranchRepositoryPort} utilizando repositorios JPA
 * para interactuar con la base de datos SQL. Gestiona la conversión entre el
 * modelo de dominio {@link Branch} y la entidad persistente {@link BranchEntity}.</p>
 */
@Component
public class BranchPersistenceAdapter implements BranchRepositoryPort {

    private final JpaBranchRepository jpaRepository;

    /**
     * Constructor para inyección de dependencias.
     * @param jpaRepository Repositorio Spring Data JPA.
     */
    public BranchPersistenceAdapter(JpaBranchRepository jpaRepository) {
        this.jpaRepository = jpaRepository;
    }

    /** {@inheritDoc} */
    @Override
    public List<Branch> findAll() {
        return jpaRepository.findAll().stream()
                .map(BranchEntity::toDomain)
                .collect(Collectors.toList());
    }

    /** {@inheritDoc} */
    @Override
    public Optional<Branch> findById(Long id) {
        return jpaRepository.findById(id)
                .map(BranchEntity::toDomain);
    }

    /** {@inheritDoc} */
    @Override
    public Branch save(Branch branch) {
        BranchEntity entity = BranchEntity.fromDomain(branch);
        return jpaRepository.save(entity).toDomain();
    }

    /** {@inheritDoc} */
    @Override
    public void deleteById(Long id) {
        if (id == null) throw new IllegalArgumentException("El ID de sucursal no puede ser nulo.");
        jpaRepository.deleteById(id);
    }
}