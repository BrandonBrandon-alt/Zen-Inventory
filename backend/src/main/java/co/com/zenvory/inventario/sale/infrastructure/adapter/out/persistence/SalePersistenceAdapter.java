package co.com.zenvory.inventario.sale.infrastructure.adapter.out.persistence;

import co.com.zenvory.inventario.sale.application.port.out.SaleRepositoryPort;
import co.com.zenvory.inventario.sale.domain.model.Sale;
import co.com.zenvory.inventario.sale.domain.model.SaleDetail;
import co.com.zenvory.inventario.sale.application.port.out.SaleFilterOptions;
import co.com.zenvory.inventario.sale.application.port.out.SalePage;
import co.com.zenvory.inventario.sale.application.port.out.SaleSearchCriteria;
import co.com.zenvory.inventario.sale.domain.model.SaleStatus;
import jakarta.persistence.EntityManager;
import jakarta.persistence.Tuple;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Expression;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@Component
public class SalePersistenceAdapter implements SaleRepositoryPort {

    /** Columnas por las que se puede ordenar el historial → propiedad de la entidad (cualquier otra clave cae al id). */
    private static final Map<String, String> SORTABLE = Map.of(
            "id", "id",
            "date", "date",
            "customer", "customerName",
            "seller", "userName",
            "branchName", "branchName",
            "total", "totalFinal",
            "status", "status");

    private final JpaSaleRepository jpaSaleRepository;
    private final EntityManager entityManager;

    public SalePersistenceAdapter(JpaSaleRepository jpaSaleRepository, EntityManager entityManager) {
        this.jpaSaleRepository = jpaSaleRepository;
        this.entityManager = entityManager;
    }

    @Override
    @Transactional(readOnly = true)
    public SalePage search(SaleSearchCriteria criteria, int page, int size, String sortBy, boolean ascending) {
        Specification<SaleEntity> spec = toSpecification(criteria);
        Sort.Direction direction = ascending ? Sort.Direction.ASC : Sort.Direction.DESC;
        String property = SORTABLE.getOrDefault(sortBy, "id");
        // El id desempata: sin él, dos ventas con el mismo valor podrían repetirse o saltarse entre páginas.
        Sort sort = property.equals("id") ? Sort.by(direction, "id") : Sort.by(direction, property).and(Sort.by(Sort.Direction.DESC, "id"));
        Page<SaleEntity> result = jpaSaleRepository.findAll(spec, PageRequest.of(page, size, sort));

        // El resumen cuenta solo las completadas, respetando el resto de filtros (si se filtra por otro estado, da 0).
        Specification<SaleEntity> completed = spec.and((root, query, cb) -> cb.equal(root.get("status"), SaleStatus.COMPLETED));
        var cb = entityManager.getCriteriaBuilder();
        var query = cb.createTupleQuery();
        var root = query.from(SaleEntity.class);
        query.select(cb.tuple(cb.count(root).alias("n"), cb.sum(root.<BigDecimal>get("totalFinal")).alias("sum")));
        query.where(completed.toPredicate(root, query, cb));
        Tuple row = entityManager.createQuery(query).getSingleResult();
        BigDecimal sum = row.get("sum", BigDecimal.class);

        return new SalePage(
                result.getContent().stream().map(this::toDomain).collect(Collectors.toList()),
                result.getTotalElements(),
                row.get("n", Long.class),
                sum == null ? BigDecimal.ZERO : sum);
    }

    @Override
    @Transactional(readOnly = true)
    public SaleFilterOptions filterOptions(Long branchId) {
        return new SaleFilterOptions(jpaSaleRepository.findDistinctSellers(branchId), jpaSaleRepository.findDistinctProducts(branchId));
    }

    private Specification<SaleEntity> toSpecification(SaleSearchCriteria c) {
        return (root, query, cb) -> {
            var predicates = new ArrayList<Predicate>();
            if (c.branchId() != null) predicates.add(cb.equal(root.get("branchId"), c.branchId()));
            if (c.status() != null) predicates.add(cb.equal(root.get("status"), c.status()));
            if (c.from() != null) predicates.add(cb.greaterThanOrEqualTo(root.get("date"), c.from().atStartOfDay()));
            if (c.to() != null) predicates.add(cb.lessThan(root.get("date"), c.to().plusDays(1).atStartOfDay()));
            if (c.seller() != null) predicates.add(cb.equal(root.get("userName"), c.seller()));
            if (c.minTotal() != null) predicates.add(cb.greaterThanOrEqualTo(root.<BigDecimal>get("totalFinal"), c.minTotal()));
            if (c.maxTotal() != null) predicates.add(cb.lessThanOrEqualTo(root.<BigDecimal>get("totalFinal"), c.maxTotal()));
            if (c.product() != null) {
                var sub = query.subquery(Long.class);
                var detail = sub.from(SaleDetailEntity.class);
                sub.select(detail.get("id")).where(cb.equal(detail.get("sale"), root), cb.equal(detail.get("productName"), c.product()));
                predicates.add(cb.exists(sub));
            }
            if (c.text() != null && !c.text().isBlank()) {
                String like = "%" + escapeLike(normalize(c.text())) + "%";
                predicates.add(cb.or(
                        cb.like(root.get("id").as(String.class), like, '\\'),
                        cb.like(unaccented(cb, root.get("customerName")), like, '\\'),
                        cb.like(unaccented(cb, root.get("customerDocument")), like, '\\'),
                        cb.like(unaccented(cb, root.get("userName")), like, '\\')));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };
    }

    private static final String ACCENTED = "áéíóúüñàèìòùâêîôû";
    private static final String PLAIN = "aeiouunaeiouaeiou";

    /** Minúsculas y sin tildes, igual que el buscador de la pantalla (así «rios» encuentra «Ríos»). */
    private static String normalize(String text) {
        return Normalizer.normalize(text.trim().toLowerCase(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
    }

    private static Expression<String> unaccented(CriteriaBuilder cb, Expression<String> column) {
        return cb.function("translate", String.class, cb.lower(column), cb.literal(ACCENTED), cb.literal(PLAIN));
    }

    private static String escapeLike(String text) {
        return text.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
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
    public Optional<Sale> findByIdForUpdate(Long id) {
        return jpaSaleRepository.findByIdForUpdate(id).map(this::toDomain);
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
