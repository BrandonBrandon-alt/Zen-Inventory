package co.com.zenvory.inventario.inventory.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.application.port.out.InventoryMovementRepositoryPort;
import co.com.zenvory.inventario.inventory.application.port.out.LocalInventoryRepositoryPort;
import co.com.zenvory.inventario.inventory.domain.exception.InsufficientStockException;
import co.com.zenvory.inventario.inventory.domain.exception.InventoryNotFoundException;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

@Service
public class InventoryService implements InventoryUseCase {

    private final LocalInventoryRepositoryPort localInventoryRepository;
    private final InventoryMovementRepositoryPort inventoryMovementRepository;
    private final ProductUseCase productUseCase;
    private final ApplicationEventPublisher eventPublisher;

    public InventoryService(LocalInventoryRepositoryPort localInventoryRepository,
                            InventoryMovementRepositoryPort inventoryMovementRepository,
                            ProductUseCase productUseCase,
                            ApplicationEventPublisher eventPublisher) {
        this.localInventoryRepository = localInventoryRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
        this.productUseCase = productUseCase;
        this.eventPublisher = eventPublisher;
    }

    @Override
    public LocalInventory getInventory(Long branchId, Long productId) {
        return localInventoryRepository.findByBranchAndProduct(branchId, productId)
                .orElseThrow(() -> new InventoryNotFoundException(branchId, productId));
    }

    @Override
    @Transactional
    public void withdrawStock(Long branchId, Long productId, String productName, BigDecimal quantity, MovementReason reason, Long userId, Long referenceId, String referenceType) {
        LocalInventory inventory = getInventory(branchId, productId);
        
        if (!inventory.hasSufficientStock(quantity)) {
            throw new InsufficientStockException(productName, quantity, inventory.getCurrentQuantity());
        }

        inventory.setCurrentQuantity(inventory.getCurrentQuantity().subtract(quantity));
        inventory.setLastUpdated(LocalDateTime.now());
        localInventoryRepository.save(inventory);

        InventoryMovement movement = InventoryMovement.builder()
                .type(MovementType.RETIRO)
                .reason(reason)
                .quantity(quantity)
                .date(LocalDateTime.now())
                .productId(productId)
                .branchId(branchId)
                .userId(userId)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .finalBalance(inventory.getCurrentQuantity())
                .build();
        inventoryMovementRepository.save(movement);
        
        // Disparar evento de auditoría/alerta si el stock bajó
        eventPublisher.publishEvent(new StockLevelDroppedEvent(this, branchId, productId));
    }

    @Override
    @Transactional
    public void addStock(Long branchId, Long productId, BigDecimal quantity, MovementReason reason, Long userId, Long referenceId, String referenceType, BigDecimal unitCost) {
        LocalInventory inventory = localInventoryRepository.findByBranchAndProduct(branchId, productId)
                .orElseGet(() -> LocalInventory.builder()
                        .branchId(branchId)
                        .productId(productId)
                        .currentQuantity(BigDecimal.ZERO)
                        .minimumStock(BigDecimal.ZERO)
                        .build());

        // Recalcular Costo Promedio si se proporciona un costo unitario
        if (unitCost != null && unitCost.compareTo(BigDecimal.ZERO) > 0) {
            updateProductAverageCost(productId, quantity, unitCost);
        }

        inventory.setCurrentQuantity(inventory.getCurrentQuantity().add(quantity));
        inventory.setLastUpdated(LocalDateTime.now());
        localInventoryRepository.save(inventory);

        InventoryMovement movement = InventoryMovement.builder()
                .type(MovementType.INGRESO)
                .reason(reason)
                .quantity(quantity)
                .date(LocalDateTime.now())
                .productId(productId)
                .branchId(branchId)
                .userId(userId)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .finalBalance(inventory.getCurrentQuantity())
                .build();
        inventoryMovementRepository.save(movement);

        // Si el stock se ha incrementado, avisamos al sistema por si debe retirar alertas críticas
        if (inventory.getCurrentQuantity().compareTo(inventory.getMinimumStock()) > 0) {
            eventPublisher.publishEvent(new co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent(this, branchId, productId));
        }
    }

    private void updateProductAverageCost(Long productId, BigDecimal newQuantity, BigDecimal unitCost) {
        Product product = productUseCase.getProductById(productId);
        
        // Obtener stock total actual en todas las sucursales
        BigDecimal currentTotalStock = localInventoryRepository.sumQuantityByProductId(productId);
        
        // Si no hay stock previo o el costo promedio es 0, el nuevo costo es el actual
        if (currentTotalStock.compareTo(BigDecimal.ZERO) <= 0 || product.getAverageCost() == null || product.getAverageCost().compareTo(BigDecimal.ZERO) == 0) {
            product.setAverageCost(unitCost);
        } else {
            // Fórmula: (CP_anterior * Stock_anterior + Costo_nuevo * Cant_nueva) / (Stock_anterior + Cant_nueva)
            BigDecimal currentTotalValue = product.getAverageCost().multiply(currentTotalStock);
            BigDecimal newInflowValue = unitCost.multiply(newQuantity);
            BigDecimal newTotalQuantity = currentTotalStock.add(newQuantity);
            
            BigDecimal newAverageCost = currentTotalValue.add(newInflowValue)
                    .divide(newTotalQuantity, 2, RoundingMode.HALF_UP);
            
            product.setAverageCost(newAverageCost);
        }
        
        productUseCase.updateProduct(productId, product);
    }

    @Override
    public List<LocalInventory> getInventoryByBranch(Long branchId) {
        return localInventoryRepository.findByBranchId(branchId);
    }

    @Override
    public List<co.com.zenvory.inventario.inventory.domain.model.LocalInventoryEnriched> getEnrichedInventoryByBranch(Long branchId) {
        List<LocalInventory> inventoryList = localInventoryRepository.findByBranchId(branchId);
        return inventoryList.stream()
                .map(inv -> {
                    Product product = productUseCase.getProductById(inv.getProductId());
                    return co.com.zenvory.inventario.inventory.domain.model.LocalInventoryEnriched.builder()
                            .id(inv.getId())
                            .productId(inv.getProductId())
                            .productNombre(product.getName())
                            .sku(product.getSku())
                            .currentQuantity(inv.getCurrentQuantity())
                            .minimumStock(inv.getMinimumStock())
                            .salePrice(product.getSalePrice())
                            .averageCost(product.getAverageCost())
                            .unit(product.getUnitAbbreviation())
                            .lastUpdated(inv.getLastUpdated())
                            .build();
                })
                .toList();
    }

    @Override
    @Transactional
    public LocalInventory updateMinimumStock(Long branchId, Long productId, BigDecimal minimumStock) {
        LocalInventory inventory = getInventory(branchId, productId);
        inventory.setMinimumStock(minimumStock);
        inventory.setLastUpdated(LocalDateTime.now());
        LocalInventory saved = localInventoryRepository.save(inventory);

        // Si el nuevo mínimo pone al producto en estado crítico, avisar
        if (saved.getCurrentQuantity().compareTo(minimumStock) <= 0) {
            eventPublisher.publishEvent(new StockLevelDroppedEvent(this, branchId, productId));
        }
        
        return saved;
    }

    @Override
    public List<InventoryMovement> getKardex(Long branchId, Long productId) {
        return inventoryMovementRepository.findByBranchAndProduct(branchId, productId);
    }

    @Override
    public List<LocalInventory> getLowStockInventories() {
        return localInventoryRepository.findLowStock();
    }

    @Override
    public List<InventoryMovement> getAllMovements() {
        return inventoryMovementRepository.findAll();
    }
}
