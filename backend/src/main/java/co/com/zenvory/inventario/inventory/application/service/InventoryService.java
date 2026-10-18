package co.com.zenvory.inventario.inventory.application.service;

import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.application.port.out.InventoryMovementRepositoryPort;
import co.com.zenvory.inventario.inventory.application.port.out.LocalInventoryRepositoryPort;
import co.com.zenvory.inventario.inventory.domain.exception.InsufficientStockException;
import co.com.zenvory.inventario.inventory.domain.model.InventoryMovement;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.inventory.domain.model.MovementType;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.catalog.domain.model.ProductUnit;
import co.com.zenvory.inventario.catalog.application.port.in.UnitOfMeasureUseCase;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicación que implementa la lógica de negocio para la gestión de inventarios.
 * 
 * <p>Orquesta las operaciones de control de existencias, asegurando la consistencia 
 * entre los saldos locales y el rastro de auditoría (Kardex). Maneja la lógica de 
 * conversión de unidades de medida, recalculo de costo promedio ponderado y 
 * publicación de eventos de stock crítico.</p>
 */
@Service
public class InventoryService implements InventoryUseCase {

    /** Repositorio de saldos de inventario por sucursal. */
    private final LocalInventoryRepositoryPort localInventoryRepository;

    /** Repositorio de historial de movimientos (Kardex). */
    private final InventoryMovementRepositoryPort inventoryMovementRepository;

    /** Puerto para consultar información técnica de productos. */
    private final ProductUseCase productUseCase;

    /** Puerto para gestionar conversiones de unidades de medida. */
    private final UnitOfMeasureUseCase unitOfMeasureUseCase;

    /** Publicador de eventos para notificaciones transversales (e.g., Alertas de stock bajo). */
    private final ApplicationEventPublisher eventPublisher;

    /**
     * Constructor con inyección de dependencias.
     * 
     * @param localInventoryRepository Repositorio de saldos locales.
     * @param inventoryMovementRepository Repositorio de movimientos.
     * @param productUseCase Servicio de productos.
     * @param unitOfMeasureUseCase Servicio de unidades de medida.
     * @param eventPublisher Publicador de eventos de aplicación.
     */
    public InventoryService(LocalInventoryRepositoryPort localInventoryRepository,
                            InventoryMovementRepositoryPort inventoryMovementRepository,
                            ProductUseCase productUseCase,
                            UnitOfMeasureUseCase unitOfMeasureUseCase,
                            ApplicationEventPublisher eventPublisher) {
        this.localInventoryRepository = localInventoryRepository;
        this.inventoryMovementRepository = inventoryMovementRepository;
        this.productUseCase = productUseCase;
        this.unitOfMeasureUseCase = unitOfMeasureUseCase;
        this.eventPublisher = eventPublisher;
    }


    @Override
    public LocalInventory getInventory(Long branchId, Long productId) {
        return localInventoryRepository.findByBranchAndProduct(branchId, productId)
                .orElseGet(() -> emptyInventory(branchId, productId));
    }

    /** Saldo para modificarlo: la fila queda bloqueada hasta el fin de la transacción (evita pérdidas de actualización). */
    private LocalInventory lockedInventory(Long branchId, Long productId) {
        // Se garantiza que la fila exista ANTES de bloquearla: sin fila no hay nada que bloquear, y dos primeras
        // operaciones simultáneas sobre el mismo (sucursal, producto) intentarían insertarla las dos.
        localInventoryRepository.ensureExists(branchId, productId);
        return localInventoryRepository.findByBranchAndProductForUpdate(branchId, productId)
                .orElseGet(() -> emptyInventory(branchId, productId));
    }

    private LocalInventory emptyInventory(Long branchId, Long productId) {
        return LocalInventory.builder()
                .branchId(branchId)
                .productId(productId)
                .currentQuantity(BigDecimal.ZERO)
                .minimumStock(BigDecimal.ZERO)
                .committedQuantity(BigDecimal.ZERO)
                .build();
    }

    @Override
    @Transactional
    public void withdrawStock(Long branchId, Long productId, String productName, BigDecimal quantity, Long unitId, MovementReason reason, Long userId, Long referenceId, String referenceType, String observations, String subReason) {
        BigDecimal finalQuantity = quantity;
        requireProduct(productId);

        // Lógica de Conversión de Unidades
        if (unitId != null) {
            finalQuantity = applyConversion(productId, unitId, quantity, null).quantity();
        }

        LocalInventory inventory = lockedInventory(branchId, productId);
        
        if (!inventory.hasSufficientStock(finalQuantity)) {
            throw new InsufficientStockException(productName, finalQuantity, inventory.getCurrentQuantity());
        }

        inventory.setCurrentQuantity(inventory.getCurrentQuantity().subtract(finalQuantity));
        inventory.setLastUpdated(LocalDateTime.now());
        localInventoryRepository.save(inventory);

        InventoryMovement movement = InventoryMovement.builder()
                .type(MovementType.RETIRO)
                .reason(reason)
                .quantity(finalQuantity)
                .date(LocalDateTime.now())
                .productId(productId)
                .branchId(branchId)
                .userId(userId)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .observations(observations)
                .subReason(subReason)
                .finalBalance(inventory.getCurrentQuantity())
                .build();
        inventoryMovementRepository.save(movement);
        
        // Solo se avisa si el producto tiene mínimo definido y lo disponible está en o bajo él: con mínimo 0 no hay
        // alertas, y avisar en cada venta/traslado cargaría el camino más usado para nada.
        if (isBelowMinimum(inventory)) {
            eventPublisher.publishEvent(new StockLevelDroppedEvent(this, branchId, productId));
        }
    }

    @Override
    @Transactional
    public void addStock(Long branchId, Long productId, BigDecimal quantity, Long unitId, MovementReason reason, Long userId, Long referenceId, String referenceType, BigDecimal unitCost, String observations, String subReason) {
        BigDecimal finalQuantity = quantity;
        BigDecimal finalUnitCost = unitCost;
        requireProduct(productId);

        // Lógica de Conversión de Unidades
        if (unitId != null) {
            var result = applyConversion(productId, unitId, quantity, unitCost);
            finalQuantity = result.quantity();
            finalUnitCost = result.unitCost();
        }

        LocalInventory inventory = lockedInventory(branchId, productId);

        // Recalcular Costo Promedio si se proporciona un costo unitario
        if (finalUnitCost != null && finalUnitCost.compareTo(BigDecimal.ZERO) > 0) {
            updateProductAverageCost(productId, finalQuantity, finalUnitCost);
        }

        inventory.setCurrentQuantity(inventory.getCurrentQuantity().add(finalQuantity));
        inventory.setLastUpdated(LocalDateTime.now());
        localInventoryRepository.save(inventory);

        InventoryMovement movement = InventoryMovement.builder()
                .type(MovementType.INGRESO)
                .reason(reason)
                .quantity(finalQuantity)
                .date(LocalDateTime.now())
                .productId(productId)
                .branchId(branchId)
                .userId(userId)
                .referenceId(referenceId)
                .referenceType(referenceType)
                .observations(observations)
                .subReason(subReason)
                .finalBalance(inventory.getCurrentQuantity())
                .build();
        inventoryMovementRepository.save(movement);

        // Si lo disponible (lo que hay menos lo comprometido en traslados) superó el mínimo, se retiran las alertas
        if (inventory.getMinimumStock().signum() > 0 && !isBelowMinimum(inventory)) {
            eventPublisher.publishEvent(new StockLevelRestoredEvent(this, branchId, productId));
        }
    }

    /**
     * Registro auxiliar para encapsular el resultado de una conversión técnica.
     */
    private record ConversionResult(BigDecimal quantity, BigDecimal unitCost) {}

    /**
     * Aplica la lógica de conversión desde una unidad secundaria a la unidad base del producto.
     * 
     * @param productId ID del producto.
     * @param unitId ID de la unidad en la que se reporta la transacción.
     * @param quantity Cantidad en la unidad reportada.
     * @param unitCost Costo en la unidad reportada (opcional).
     * @return Resultado con cantidad y costo normalizados a la unidad base.
     */
    private ConversionResult applyConversion(Long productId, Long unitId, BigDecimal quantity, BigDecimal unitCost) {
        // Reportar en la unidad base del producto no requiere conversión.
        if (unitId.equals(productUseCase.getProductById(productId).getUnitId())) {
            return new ConversionResult(quantity, unitCost);
        }
        List<ProductUnit> units = unitOfMeasureUseCase.getUnitsByProduct(productId);
        ProductUnit targetUnit = units.stream()
                .filter(u -> u.getUnitId().equals(unitId))
                .findFirst()
                .orElse(null);

        // Una unidad desconocida o sin factor no se puede "adivinar" como base: 5 cajas de 12 quedarían como 5 unidades.
        if (targetUnit == null || targetUnit.getConversionFactor() == null || targetUnit.getConversionFactor().signum() <= 0) {
            throw new IllegalArgumentException("La unidad indicada no está configurada con un factor de conversión para este producto.");
        }

        BigDecimal factor = targetUnit.getConversionFactor();
        BigDecimal finalQuantity = quantity.multiply(factor);
        BigDecimal finalUnitCost = unitCost != null 
                ? unitCost.divide(factor, 4, RoundingMode.HALF_UP) 
                : null;

        return new ConversionResult(finalQuantity, finalUnitCost);
    }

    @Override
    @Transactional
    public void reserveStock(Long branchId, Long productId, BigDecimal quantity) {
        requireProduct(productId);
        LocalInventory inventory = lockedInventory(branchId, productId);
        
        if (!inventory.hasSufficientStock(quantity)) {
            Product product = productUseCase.getProductById(productId);
            throw new InsufficientStockException(product.getName(), quantity, 
                    inventory.getCurrentQuantity().subtract(inventory.getCommittedQuantity() != null ? inventory.getCommittedQuantity() : BigDecimal.ZERO));
        }

        BigDecimal currentCommitted = inventory.getCommittedQuantity() != null ? inventory.getCommittedQuantity() : BigDecimal.ZERO;
        inventory.setCommittedQuantity(currentCommitted.add(quantity));
        inventory.setLastUpdated(LocalDateTime.now());
        localInventoryRepository.save(inventory);
    }

    @Override
    @Transactional
    public void releaseStock(Long branchId, Long productId, BigDecimal quantity) {
        LocalInventory inventory = lockedInventory(branchId, productId);
        BigDecimal currentCommitted = inventory.getCommittedQuantity() != null ? inventory.getCommittedQuantity() : BigDecimal.ZERO;
        
        BigDecimal newCommitted = currentCommitted.subtract(quantity);
        if (newCommitted.compareTo(BigDecimal.ZERO) < 0) {
            newCommitted = BigDecimal.ZERO;
        }
        
        inventory.setCommittedQuantity(newCommitted);
        inventory.setLastUpdated(LocalDateTime.now());
        localInventoryRepository.save(inventory);
    }

    /**
     * Actualiza el costo promedio ponderado de un producto tras un nuevo ingreso.
     * 
     * <p>Utiliza la fórmula: (CostoActual * StockTotal + CostoNuevo * CantidadNueva) / (StockTotal + CantidadNueva)</p>
     * 
     * @param productId ID del producto a actualizar.
     * @param newQuantity Cantidad que ingresa al sistema (normalizada).
     * @param unitCost Costo unitario de la nueva entrada (normalizado).
     */
    private void updateProductAverageCost(Long productId, BigDecimal newQuantity, BigDecimal unitCost) {
        // La fila del producto se bloquea mientras se recalcula: dos ingresos simultáneos (de la misma o de distintas
        // sucursales) leerían el mismo costo anterior y el último en escribir borraría el aporte del otro.
        Product product = productUseCase.getProductForCostUpdate(productId);
        
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
        
        // Solo el costo: reescribir el producto entero podía pisar ediciones simultáneas de precio o nombre.
        productUseCase.updateAverageCost(productId, product.getAverageCost());
    }

    private void requireProduct(Long productId) {
        productUseCase.getProductById(productId);
    }

    /** Lo disponible está en o bajo el mínimo definido (con mínimo 0 no hay alertas de stock). */
    private static boolean isBelowMinimum(LocalInventory inventory) {
        BigDecimal minimum = inventory.getMinimumStock() != null ? inventory.getMinimumStock() : BigDecimal.ZERO;
        return minimum.signum() > 0 && inventory.availableQuantity().compareTo(minimum) <= 0;
    }

    @Override
    public List<LocalInventory> getInventoryByBranch(Long branchId) {
        return localInventoryRepository.findByBranchId(branchId);
    }

    @Override
    public List<co.com.zenvory.inventario.inventory.domain.model.LocalInventoryEnriched> getEnrichedInventoryByBranch(Long branchId) {
        List<LocalInventory> inventoryList = localInventoryRepository.findByBranchId(branchId);
        // Una sola consulta de productos (antes una por fila); un producto que ya no existe se omite en vez de
        // hacer fallar todo el listado.
        java.util.Map<Long, Product> productsById = productUseCase.getAllProducts().stream()
                .collect(java.util.stream.Collectors.toMap(Product::getId, p -> p, (a, b) -> a));
        return inventoryList.stream()
                .filter(inv -> productsById.containsKey(inv.getProductId()))
                .map(inv -> {
                    Product product = productsById.get(inv.getProductId());
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
                            .productActive(product.getActive())
                            .lastUpdated(inv.getLastUpdated())
                            .build();
                })
                .toList();
    }

    @Override
    @Transactional
    public LocalInventory updateMinimumStock(Long branchId, Long productId, BigDecimal minimumStock) {
        if (minimumStock == null || minimumStock.signum() < 0) {
            throw new IllegalArgumentException("El stock mínimo no puede ser negativo.");
        }
        requireProduct(productId);
        LocalInventory inventory = lockedInventory(branchId, productId);

        inventory.setMinimumStock(minimumStock);
        inventory.setLastUpdated(LocalDateTime.now());
        LocalInventory saved = localInventoryRepository.save(inventory);

        // Si el nuevo mínimo pone al producto en estado crítico, avisar
        if (isBelowMinimum(saved)) {
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

    @Override
    public List<InventoryMovement> getMovementsByBranch(Long branchId) {
        return inventoryMovementRepository.findByBranchId(branchId);
    }
}
