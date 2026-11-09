package co.com.zenvory.inventario.purchase.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.purchase.application.port.out.PurchaseRepositoryPort;
import co.com.zenvory.inventario.purchase.domain.model.PaymentMethod;
import co.com.zenvory.inventario.purchase.domain.model.PaymentStatus;
import co.com.zenvory.inventario.purchase.domain.model.PurchasePayment;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrderDetail;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class PurchasePersistenceAdapter implements PurchaseRepositoryPort {

    private final JpaPurchaseRepository repository;

    public PurchasePersistenceAdapter(JpaPurchaseRepository repository) {
        this.repository = repository;
    }

    @Override
    public PurchaseOrder save(PurchaseOrder purchaseOrder) {
        PurchaseOrderEntity entity = toEntity(purchaseOrder);
        PurchaseOrderEntity savedEntity = repository.save(entity);
        return toDomain(savedEntity);
    }

    @Override
    public Optional<PurchaseOrder> findById(Long id) {
        return repository.findById(id).map(this::toDomain);
    }

    @Override
    public List<PurchaseOrder> findAll() {
        return repository.findAll().stream()
                .map(this::toDomain)
                .toList();
    }

    @Override
    public List<PurchaseOrder> findByBranchId(Long branchId) {
        return repository.findByBranchId(branchId).stream()
                .map(this::toDomain)
                .toList();
    }

    public PurchaseOrderEntity toEntity(PurchaseOrder domain) {
        PurchaseOrderEntity entity = new PurchaseOrderEntity();
        entity.setId(domain.getId());
        entity.setSupplierId(domain.getSupplierId());
        entity.setBranchId(domain.getBranchId());
        entity.setUserId(domain.getUserId());
        entity.setReceivingUserId(domain.getReceivingUserId());
        entity.setRequestDate(domain.getRequestDate());
        entity.setEstimatedArrivalDate(domain.getEstimatedArrivalDate());
        entity.setActualArrivalDate(domain.getActualArrivalDate());
        entity.setDeliveryLeadTimeDays(domain.getDeliveryLeadTimeDays());
        entity.setReceptionStatus(domain.getReceptionStatus().name());
        entity.setPaymentStatus(domain.getPaymentStatus().name());
        entity.setPaymentDueDate(domain.getPaymentDueDate());
        entity.setPaymentDueDays(domain.getPaymentDueDays());
        entity.setTotal(domain.getTotal());
        entity.setReasonResolution(domain.getReasonResolution());
        entity.setResueltoPorId(domain.getResolvedById());
        entity.setFechaResolucion(domain.getResolutionDate());
        entity.setExceptionApproved(domain.isExceptionApproved());
        entity.setVersion(domain.getVersion());

        domain.getDetails().forEach(d -> {
            PurchaseDetailEntity dEntity = new PurchaseDetailEntity();
            dEntity.setId(d.getId());
            dEntity.setProductId(d.getProductId());
            dEntity.setQuantity(d.getQuantity());
            dEntity.setUnitPrice(d.getUnitPrice());
            dEntity.setDiscountPct(d.getDiscountPct());
            dEntity.setReceivedQuantity(d.getReceivedQuantity());
            dEntity.setSubtotal(d.computeSubtotal());
            entity.addDetail(dEntity);
        });

        domain.getPayments().forEach(p -> {
            PurchasePaymentEntity pEntity = new PurchasePaymentEntity();
            pEntity.setId(p.getId());
            pEntity.setAmount(p.getAmount());
            pEntity.setDate(p.getDate());
            pEntity.setUserId(p.getUserId());
            pEntity.setUserName(p.getUserName());
            pEntity.setMethod(p.getMethod().name());
            pEntity.setReference(p.getReference());
            pEntity.setNotes(p.getNotes());
            entity.addPayment(pEntity);
        });

        return entity;
    }

    public PurchaseOrder toDomain(PurchaseOrderEntity entity) {
        List<PurchaseOrderDetail> details = entity.getDetails().stream()
                .map(d -> new PurchaseOrderDetail(d.getId(), d.getProductId(), d.getQuantity(), d.getUnitPrice(),
                        d.getDiscountPct(), d.getReceivedQuantity()))
                .toList();
        List<PurchasePayment> payments = entity.getPayments().stream()
                .map(p -> new PurchasePayment(p.getId(), p.getAmount(), p.getDate(), p.getUserId(), p.getUserName(),
                        PaymentMethod.valueOf(p.getMethod()), p.getReference(), p.getNotes()))
                .toList();

        return new PurchaseOrder(
                entity.getId(),
                entity.getSupplierId(),
                entity.getBranchId(),
                entity.getUserId(),
                entity.getReceivingUserId(),
                entity.getRequestDate(),
                entity.getEstimatedArrivalDate(),
                entity.getActualArrivalDate(),
                entity.getDeliveryLeadTimeDays(),
                ReceptionStatus.valueOf(entity.getReceptionStatus()),
                PaymentStatus.valueOf(entity.getPaymentStatus()),
                entity.getPaymentDueDays(),
                entity.getPaymentDueDate(),
                entity.getTotal(),
                details,
                entity.getReasonResolution(),
                entity.getResueltoPorId(),
                entity.getFechaResolucion(),
                entity.isExceptionApproved(),
                entity.getVersion(),
                payments);
    }}
    
    
    
    
    
    
    
    
    
    
    

    
                        