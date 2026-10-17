package co.com.zenvory.inventario.alert.application.service;

import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.alert.application.port.out.AlertRepositoryPort;
import co.com.zenvory.inventario.alert.domain.model.ResolutionType;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.transfer.application.port.in.RequestTransferCommand;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Async;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Servicio de aplicación que implementa la lógica de gestión de alertas de stock.
 * 
 * <p>Responsabilidades principales:
 * <ul>
 *     <li>Monitoreo de niveles de inventario (proactivo y reactivo).</li>
 *     <li>Creación de alertas de bajo stock y quiebres.</li>
 *     <li>Gestión de la resolución de alertas mediante traslados o compras.</li>
 *     <li>Sincronización de alertas según eventos del sistema.</li>
 * </ul>
 * </p>
 * 
 * <p>Contexto: Este servicio actúa como el director de orquesta para resolver problemas de 
 * disponibilidad de productos, interactuando con los módulos de Inventario, Compras y Traslados.</p>
 */
@Service
public class AlertService implements AlertUseCase {

    private final AlertRepositoryPort alertRepository;
    private final InventoryUseCase inventoryUseCase;
    private final ProductUseCase productUseCase;
    private final BranchUseCase branchUseCase;
    private final TransferUseCase transferUseCase;
    private final PurchaseUseCase purchaseUseCase;
    private final TransactionTemplate perItemTransaction;
    private static final Logger log = LoggerFactory.getLogger(AlertService.class);

    /**
     * Constructor único para inyección de dependencias.
     * 
     * @param alertRepository Adaptador de persistencia para alertas.
     * @param inventoryUseCase Caso de uso para consulta de stock.
     * @param productUseCase Caso de uso para obtener metadatos de productos.
     * @param branchUseCase Caso de uso para obtener información de sucursales.
     * @param transferUseCase Caso de uso para generar traslados internos.
     * @param purchaseUseCase Caso de uso para generar órdenes de compra.
     */
    public AlertService(AlertRepositoryPort alertRepository, 
                        InventoryUseCase inventoryUseCase,
                        ProductUseCase productUseCase,
                        BranchUseCase branchUseCase,
                        TransferUseCase transferUseCase,
                        PurchaseUseCase purchaseUseCase,
                        PlatformTransactionManager transactionManager) {
        this.alertRepository = alertRepository;
        this.inventoryUseCase = inventoryUseCase;
        this.productUseCase = productUseCase;
        this.branchUseCase = branchUseCase;
        this.transferUseCase = transferUseCase;
        this.purchaseUseCase = purchaseUseCase;
        // Cada elemento del escaneo va en su propia transacción: un registro dañado no revierte los demás.
        this.perItemTransaction = new TransactionTemplate(transactionManager);
        this.perItemTransaction.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);
    }

    /**
     * Motor de escaneo automático. Se ejecuta periódicamente en segundo plano.
     * 
     * <p>Configuración:
     * - interval: 5 minutos (300,000ms)
     * - initialDelay: 30 segundos
     * </p>
     */
    @Override
    @Scheduled(fixedDelayString = "300000", initialDelayString = "30000")
    public void scanForAlerts() {
        log.debug("Iniciando escaneo programado de alertas de bajo stock...");
        // Una sola consulta con las alertas de stock bajo ya abiertas, en vez de una por cada fila de stock bajo.
        java.util.Set<String> alreadyAlerted = alertRepository.findAllUnresolvedByType(StockAlert.AlertType.LOW_STOCK).stream()
                .map(a -> a.getBranchId() + ":" + a.getProductId())
                .collect(java.util.stream.Collectors.toSet());
        for (LocalInventory inv : inventoryUseCase.getLowStockInventories()) {
            if (alreadyAlerted.contains(inv.getBranchId() + ":" + inv.getProductId())) {
                continue;
            }
            try {
                perItemTransaction.executeWithoutResult(status -> handleLowStockCheck(inv));
            } catch (RuntimeException e) {
                log.error("No se pudo evaluar la alerta de stock bajo (sucursal {}, producto {}): {}",
                        inv.getBranchId(), inv.getProductId(), e.getMessage());
            }
        }
    }

    /**
     * Reacciona de forma asíncrona cuando un evento indica que el stock ha bajado.
     * Se ejecuta después del commit de la transacción que originó la baja.
     * 
     * @param event Evento con los datos del producto y sucursal afectados.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onStockLevelDropped(StockLevelDroppedEvent event) {
        try {
            log.info("Iniciando procesamiento de alerta de stock bajo... [TX_EVENT]");
            LocalInventory inv = inventoryUseCase.getInventory(event.getBranchId(), event.getProductId());
            handleLowStockCheck(inv);
        } catch (Exception e) {
            log.error("Error crítico procesando alerta de stock bajo para producto {} en sucursal {}: {}", 
                    event.getProductId(), event.getBranchId(), e.getMessage());
        }
    }

    /**
     * Cierra las alertas de "solicitud de traslado" de los productos de un traslado cuando el origen autoriza su
     * salida. Corre tras el commit y en su propia transacción: si falla, el traslado ya quedó preparado.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onTransferPrepared(co.com.zenvory.inventario.transfer.domain.event.TransferPreparedEvent event) {
        try {
            for (StockAlert alert : alertRepository.findActiveAlerts(event.originBranchId())) {
                if (alert.getType() == StockAlert.AlertType.TRANSFER_REQUEST && event.productIds().contains(alert.getProductId())) {
                    try {
                        dismissAlert(alert.getId(), "Transferencia autorizada por el gerente");
                    } catch (RuntimeException e) {
                        // Una alerta ya resuelta por otro lado no debe impedir cerrar las demás.
                        log.warn("No se pudo cerrar la alerta {} del traslado {}: {}", alert.getId(), event.transferId(), e.getMessage());
                    }
                }
            }
        } catch (Exception e) {
            log.error("No se pudieron cerrar las alertas del traslado {}: {}", event.transferId(), e.getMessage());
        }
    }

    /**
     * Reacciona de forma asíncrona cuando un evento indica que el stock se ha restaurado.
     * Permite limpiar o resolver alertas de stock bajo que ya no son necesarias.
     * 
     * @param event Evento de restauración de niveles.
     */
    @Async
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void onStockLevelRestored(StockLevelRestoredEvent event) {
        try {
            log.info("Iniciando verificación de restauración de stock... [TX_EVENT]");
            handleRestoredStockCheck(event.getBranchId(), event.getProductId());
        } catch (Exception e) {
            log.error("Error crítico procesando restauración de stock para producto {} en sucursal {}: {}", 
                    event.getProductId(), event.getBranchId(), e.getMessage());
        }
    }

    /**
     * Lógica central para determinar si se debe crear una nueva alerta por bajo stock.
     * Implementa validaciones para evitar duplicación de alertas (spam).
     * 
     * @param inv Estado actual del inventario local a evaluar.
     */
    @Transactional
    public void handleLowStockCheck(LocalInventory inv) {
        // Condición: stock disponible (lo que hay menos lo comprometido en traslados) <= mínimo, y el mínimo está definido (>0)
        if (inv.availableQuantity().compareTo(inv.getMinimumStock()) <= 0 && inv.getMinimumStock().compareTo(java.math.BigDecimal.ZERO) > 0) {
            
            // Verificación de redundancia: si ya hay una alerta de STOCK BAJO activa para este producto/sucursal, no
            // creamos otra. Otras alertas abiertas (solicitud de traslado, novedades…) no la reemplazan. El candado
            // evita que el escaneo y el listener asíncrono comprueben a la vez y creen dos.
            alertRepository.lockForCreation(inv.getBranchId(), inv.getProductId());
            List<StockAlert> unresolves = alertRepository.findUnresolvedByBranchProductAndType(inv.getBranchId(),
                    inv.getProductId(), StockAlert.AlertType.LOW_STOCK);
            
            if (unresolves.isEmpty()) {
                String actual = inv.availableQuantity().stripTrailingZeros().toPlainString();
                String minimo = inv.getMinimumStock().stripTrailingZeros().toPlainString();
                
                // Enriquecimiento de datos para el mensaje descriptivo
                Product product = productUseCase.getProductById(inv.getProductId());
                Branch branch = branchUseCase.getBranchById(inv.getBranchId());
                String unidad = product.getUnitAbbreviation() != null ? product.getUnitAbbreviation() : "UND";

                String msg = String.format("⚠ Stock crítico en %s: %s tiene solo %s %s (Mínimo: %s)",
                        branch.getName(), product.getName(), actual, unidad, minimo);

                StockAlert alert = StockAlert.create(inv.getBranchId(), inv.getProductId(), msg);
                alertRepository.save(alert);
                log.info("Nueva alerta generada: {}", msg);
            }
        }
    }

    /**
     * Resuelve automáticamente alertas activas cuando el stock vuelve a niveles normales.
     * 
     * @param branchId Sucursal.
     * @param productId Producto.
     */
    @Override
    @Transactional
    public void handleRestoredStockCheck(Long branchId, Long productId) {
        // Solo se cierran las alertas de STOCK BAJO, y solo si lo disponible realmente superó el mínimo (el evento
        // puede llegar tarde o por un ingreso pequeño que aún no alcanza).
        LocalInventory inv = inventoryUseCase.getInventory(branchId, productId);
        if (inv.getMinimumStock() != null && inv.getMinimumStock().signum() > 0
                && inv.availableQuantity().compareTo(inv.getMinimumStock()) <= 0) {
            return;
        }
        List<StockAlert> activeAlerts = alertRepository.findUnresolvedByBranchProductAndType(branchId, productId, StockAlert.AlertType.LOW_STOCK);
        for (StockAlert alert : activeAlerts) {
            alert.resolve(ResolutionType.DISMISSED, null, "Stock restaurado a niveles seguros automáticamente");
            alertRepository.save(alert);
            log.info("Alerta resuelta automáticamente por restauración de stock. ID: {}", alert.getId());
        }
    }

    /**
     * Crea una alerta de tipo estándar (INFO).
     */
    @Override
    @Transactional
    public void createAlert(Long branchId, Long productId, String message) {
        StockAlert alert = StockAlert.create(branchId, productId, message);
        alertRepository.save(alert);
    }

    /**
     * Crea una alerta con tipificación y referencia externa específica.
     */
    @Override
    @Transactional
    public void createAlert(Long branchId, Long productId, String message, StockAlert.AlertType type, Long referenceId) {
        StockAlert alert = StockAlert.create(branchId, productId, message, type, referenceId);
        alertRepository.save(alert);
    }

    @Override
    public List<StockAlert> getActiveAlerts(Long branchId) {
        return alertRepository.findActiveAlerts(branchId);
    }

    @Override
    public List<StockAlert> getGlobalActiveAlerts() {
        return alertRepository.getGlobalActiveAlerts();
    }

    @Override
    public StockAlert getAlertById(Long alertId) {
        return findAlert(alertId);
    }

    @Override
    @Transactional
    public void resolveAlert(Long alertId) {
        StockAlert alert = findAlertForUpdate(alertId);
        alert.resolve(ResolutionType.DISMISSED, null, "Resolución manual genérica");
        alertRepository.save(alert);
    }

    /**
     * Orquestación de resolución vía traslado interno.
     * Delega la creación de la solicitud al módulo de Transferencias.
     */
    @Override
    @Transactional
    public void resolveViaTransfer(Long alertId, Long originBranchId, Integer quantity, Long userId, String priority) {
        // La alerta se bloquea y se comprueba ANTES de crear el traslado: dos resoluciones simultáneas (doble clic, dos
        // gerentes) generarían dos documentos, y la segunda solo fallaría al intentar marcar la alerta.
        StockAlert alert = findAlertForUpdate(alertId);
        requireOpen(alert);
        if (originBranchId == null || originBranchId.equals(alert.getBranchId())) {
            throw new IllegalArgumentException("La sucursal de origen debe indicarse y ser distinta de la de la alerta.");
        }
        if (quantity == null || quantity <= 0) {
            throw new IllegalArgumentException("La cantidad a trasladar debe ser mayor a cero.");
        }
        co.com.zenvory.inventario.transfer.domain.model.TransferPriority transferPriority = parsePriority(priority);

        RequestTransferCommand cmd = new RequestTransferCommand(
                originBranchId,
                alert.getBranchId(),
                LocalDateTime.now().plusDays(2),
                transferPriority,
                List.of(new RequestTransferCommand.Detail(alert.getProductId(), quantity))
        );
        
        var transfer = transferUseCase.requestTransfer(cmd);
        
        // Vinculación de la alerta con el documento de traslado generado
        alert.resolve(ResolutionType.TRANSFER, transfer.getId(), "Abastecimiento vía transferencia interna");
        alertRepository.save(alert);
        log.info("Alerta {} resuelta mediante Traslado {}", alertId, transfer.getId());
    }

    /**
     * Orquestación de resolución vía compra externa.
     * Delega la creación del borrador de orden al módulo de Compras.
     */
    @Override
    @Transactional
    public void resolveViaPurchaseOrder(Long alertId, Integer leadTimeDays, BigDecimal quantity, Long userId, boolean isManager, Long supplierId) {
        StockAlert alert = findAlertForUpdate(alertId);
        requireOpen(alert);
        if (userId == null) {
            throw new IllegalArgumentException("No se pudo identificar al usuario que genera la orden.");
        }
        if (supplierId == null) {
            throw new IllegalArgumentException("Debe indicar el proveedor.");
        }
        if (quantity == null || quantity.signum() <= 0) {
            throw new IllegalArgumentException("La cantidad a comprar debe ser mayor a cero.");
        }
        if (leadTimeDays == null || leadTimeDays <= 0) {
            throw new IllegalArgumentException("El tiempo de entrega debe ser mayor a cero.");
        }
        Product product = productUseCase.getProductById(alert.getProductId());
        
        // Creación del comando de compra basado en los datos de la alerta y el producto
        CreatePurchaseCommand cmd = new CreatePurchaseCommand(
                supplierId,
                userId,
                alert.getBranchId(),
                leadTimeDays,
                30,
                List.of(new CreatePurchaseCommand.Detail(
                        alert.getProductId(), 
                        quantity,
                        // Un producto que nunca se compró no tiene costo promedio: la orden nace con precio 0
                        // (por definir) en vez de fallar, y un precio 0 no altera el costo al recibirse.
                        product.getAverageCost() != null ? product.getAverageCost() : BigDecimal.ZERO,
                        BigDecimal.ZERO
                ))
        );
        
        var order = purchaseUseCase.createOrder(cmd, isManager);
        
        // Vinculación de la alerta con la orden de compra generada
        alert.resolve(ResolutionType.PURCHASE, order.getId(), "Abastecimiento vía orden de compra");
        alertRepository.save(alert);
        log.info("Alerta {} resuelta mediante Orden de Compra {}", alertId, order.getId());
    }

    @Override
    @Transactional
    public void dismissAlert(Long alertId, String reason) {
        StockAlert alert = findAlertForUpdate(alertId);
        alert.resolve(ResolutionType.DISMISSED, null, reason);
        alertRepository.save(alert);
    }

    /**
     * Método auxiliar de búsqueda con validación de existencia.
     */
    private StockAlert findAlertForUpdate(Long id) {
        return alertRepository.findByIdForUpdate(id)
                .orElseThrow(() -> new IllegalArgumentException("No se encontró la alerta de stock solicitada."));
    }

    private static void requireOpen(StockAlert alert) {
        if (alert.isResolved()) {
            throw new co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException("Esta alerta de stock ya se encuentra resuelta.");
        }
    }

    private static co.com.zenvory.inventario.transfer.domain.model.TransferPriority parsePriority(String priority) {
        if (priority == null || priority.isBlank()) {
            return co.com.zenvory.inventario.transfer.domain.model.TransferPriority.HIGH;
        }
        try {
            return co.com.zenvory.inventario.transfer.domain.model.TransferPriority.valueOf(priority.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("La prioridad '" + priority + "' no es válida.");
        }
    }

    private StockAlert findAlert(Long id) {
        return alertRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("No se encontró la alerta de stock solicitada."));
    }
}
