package co.com.zenvory.inventario.pricelist.infrastructure.adapter.out.persistence;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface JpaPriceListRepository extends JpaRepository<PriceListEntity, Long> {
    List<PriceListEntity> findByActivaTrue();
}
