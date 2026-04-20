package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.application.port.out.SaleRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.Sale;
import co.com.zenvory.inventario.sale.domain.model.SaleDetail;
import org.springframework.stereotype.Component;

import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class SalePersistenceAdapter implements SaleRepositoryPort {

    private final JpaSaleRepository jpaSaleRepository;

    public SalePersistenceAdapter(JpaSaleRepository jpaSaleRepository) {
        this.jpaSaleRepository = jpaSaleRepository;
    }

    @Override
    public Sale save(Sale sale) {
        SaleEntity entity = toEntity(sale);
        SaleEntity savedEntity = jpaSaleRepository.save(entity);
        return toDomain(savedEntity);
    }

    @Override
    public Optional<Sale> findById(Long id) {
        return jpaSaleRepository.findById(id).map(this::toDomain);
    }

    @Override
    public java.util.List<Sale> findAll() {
        return jpaSaleRepository.findAll().stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    public java.util.List<Sale> findByBranchId(Long branchId) {
        return jpaSaleRepository.findByBranchId(branchId).stream()
                .map(this::toDomain)
                .collect(Collectors.toList());
    }

    @Override
    @org.springframework.transaction.annotation.Transactional
    public void updateStatus(Long saleId, co.com.zenvory.inventario.sale.domain.model.SaleStatus status) {
        jpaSaleRepository.updateStatus(saleId, status);
    }

    private SaleEntity toEntity(Sale domain) {
        SaleEntity entity = new SaleEntity();
        entity.setId(domain.getId());
        entity.setDate(domain.getDate());
        entity.setSubtotal(domain.getSubtotal());
        entity.setTotalDiscount(domain.getTotalDiscount());
        entity.setTotalFinal(domain.getTotalFinal());
        entity.setBranchId(domain.getBranchId());
        entity.setBranchName(domain.getBranchName());
        entity.setUserId(domain.getUserId());
        entity.setUserName(domain.getUserName());
        entity.setStatus(domain.getStatus());
        entity.setCancellationReason(domain.getCancellationReason());
        entity.setCustomerName(domain.getCustomerName());
        entity.setCustomerDocument(domain.getCustomerDocument());
        entity.setGlobalDiscountPercentage(domain.getGlobalDiscountPercentage());

        if (domain.getDetails() != null) {
            for (SaleDetail detail : domain.getDetails()) {
                SaleDetailEntity detailEntity = new SaleDetailEntity();
                detailEntity.setId(detail.getId());
                detailEntity.setProductId(detail.getProductId());
                detailEntity.setProductName(detail.getProductName());
                detailEntity.setQuantity(detail.getQuantity());
                detailEntity.setUnitPriceApplied(detail.getUnitPriceApplied());
                detailEntity.setDiscountPercentage(detail.getDiscountPercentage());
                detailEntity.setSubtotalLine(detail.getSubtotalLine());
                
                entity.addDetail(detailEntity);
            }
        }
        return entity;
    }

    private Sale toDomain(SaleEntity entity) {
        return new Sale(
                entity.getId(),
                entity.getDate(),
                entity.getBranchId(),
                entity.getBranchName(),
                entity.getUserId(),
                entity.getUserName(),
                entity.getStatus(),
                entity.getCancellationReason(),
                entity.getCustomerName(),
                entity.getCustomerDocument(),
                entity.getGlobalDiscountPercentage(),
                entity.getDetails().stream().map(d -> new SaleDetail(
                        d.getId(),
                        d.getProductId(),
                        d.getProductName(),
                        d.getQuantity(),
                        d.getUnitPriceApplied(),
                        d.getDiscountPercentage()
                )).collect(Collectors.toList())
        );
    }
}
