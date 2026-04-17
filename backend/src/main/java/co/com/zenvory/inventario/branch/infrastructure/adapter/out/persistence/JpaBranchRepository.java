package co.com.zenvory.inventario.branch.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JpaBranchRepository extends JpaRepository<BranchEntity, Long> {
}