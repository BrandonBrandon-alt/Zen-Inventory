package co.com.zenvory.inventario.alert.application.service;

import co.com.zenvory.inventario.alert.application.port.out.AlertRepositoryPort;
import co.com.zenvory.inventario.alert.domain.model.StockAlert;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent;
import co.com.zenvory.inventario.purchase.application.port.in.CreatePurchaseCommand;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.transfer.application.port.in.TransferUseCase;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.context.event.EventListener;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

import java.lang.reflect.Method;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("AlertService")
class AlertServiceTest {

    private AlertRepositoryPort alerts;
    private ProductUseCase products;
    private PurchaseUseCase purchases;
    private AlertService service;
    private InventoryUseCase inventory;
    private TransferUseCase transfers;

    @BeforeEach
    void setUp() {
        alerts = mock(AlertRepositoryPort.class);
        products = mock(ProductUseCase.class);
        purchases = mock(PurchaseUseCase.class);
        inventory = mock(InventoryUseCase.class);
        transfers = mock(TransferUseCase.class);
        service = new AlertService(alerts, inventory, products, mock(BranchUseCase.class),
                transfers, purchases, mock(org.springframework.transaction.PlatformTransactionManager.class));
        when(alerts.findByIdForUpdate(1L)).thenReturn(Optional.of(StockAlert.create(3L, 5L, "Stock bajo")));
        PurchaseOrder order = mock(PurchaseOrder.class);
        when(order.getId()).thenReturn(40L);
        when(purchases.createOrder(any(), org.mockito.ArgumentMatchers.anyBoolean())).thenReturn(order);
    }

    private BigDecimal priceSentToPurchase() {
        ArgumentCaptor<CreatePurchaseCommand> cmd = ArgumentCaptor.forClass(CreatePurchaseCommand.class);
        verify(purchases).createOrder(cmd.capture(), org.mockito.ArgumentMatchers.anyBoolean());
        return cmd.getValue().items().get(0).unitPrice();
    }

    @Test
    @DisplayName("resolver por compra un producto sin costo promedio (nunca comprado) no falla: precio 0 por definir")
    void resolveViaPurchaseWithoutAverageCost() {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("Nuevo").averageCost(null).build());
        service.resolveViaPurchaseOrder(1L, 3, BigDecimal.TEN, 9L, true, 7L);
        assertThat(priceSentToPurchase()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("con costo promedio, la orden usa ese costo")
    void resolveViaPurchaseWithAverageCost() {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("Viejo").averageCost(new BigDecimal("12.5")).build());
        service.resolveViaPurchaseOrder(1L, 3, BigDecimal.TEN, 9L, true, 7L);
        assertThat(priceSentToPurchase()).isEqualByComparingTo("12.5");
    }

    @Test
    @DisplayName("cada evento de stock bajo tiene un único manejador: dos duplicarían las alertas y atarían la venta a su éxito")
    void singleHandlerPerStockDroppedEvent() {
        ClassPathScanningCandidateComponentProvider scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(Component.class));
        List<String> handlers = new ArrayList<>();
        for (var bean : scanner.findCandidateComponents("co.com.zenvory.inventario")) {
            Class<?> type;
            try {
                type = Class.forName(bean.getBeanClassName());
            } catch (ClassNotFoundException e) {
                continue;
            }
            for (Method method : type.getDeclaredMethods()) {
                boolean listener = method.isAnnotationPresent(EventListener.class) || method.isAnnotationPresent(TransactionalEventListener.class);
                if (listener && method.getParameterCount() == 1 && method.getParameterTypes()[0] == StockLevelDroppedEvent.class) {
                    handlers.add(type.getSimpleName() + "." + method.getName());
                }
            }
        }
        assertThat(handlers).containsExactly("AlertService.onStockLevelDropped");
    }

    @Test
    @DisplayName("al preparar un traslado se cierran solo las alertas de solicitud de traslado de sus productos")
    void transferPreparedDismissesMatchingAlerts() {
        StockAlert match = new StockAlert(100L, 3L, 5L, "Solicitud", java.time.LocalDateTime.now(), false,
                null, StockAlert.AlertType.TRANSFER_REQUEST, null, null, null);
        StockAlert otherProduct = new StockAlert(101L, 3L, 6L, "Solicitud", java.time.LocalDateTime.now(), false,
                null, StockAlert.AlertType.TRANSFER_REQUEST, null, null, null);
        // Un mensaje que casualmente dice "Solicitud de Traslado" pero es de stock bajo NO se cierra (se decide por tipo).
        StockAlert lowStock = new StockAlert(102L, 3L, 5L, "Solicitud de Traslado en el texto", java.time.LocalDateTime.now(), false,
                null, StockAlert.AlertType.LOW_STOCK, null, null, null);
        when(alerts.findActiveAlerts(3L)).thenReturn(List.of(match, otherProduct, lowStock));
        when(alerts.findByIdForUpdate(100L)).thenReturn(Optional.of(match));
        when(alerts.findByIdForUpdate(101L)).thenReturn(Optional.of(otherProduct));
        when(alerts.findByIdForUpdate(102L)).thenReturn(Optional.of(lowStock));

        service.onTransferPrepared(new co.com.zenvory.inventario.transfer.domain.event.TransferPreparedEvent(
                9L, 3L, java.util.Set.of(5L)));

        assertThat(match.isResolved()).isTrue();
        assertThat(otherProduct.isResolved()).isFalse();
        assertThat(lowStock.isResolved()).isFalse();
    }

    @Test
    @DisplayName("la alerta de stock bajo se decide con el stock DISPONIBLE (actual menos comprometido), no con el actual")
    void lowStockUsesAvailableQuantity() {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("P").build());
        var branches = mock(BranchUseCase.class);
        var alertsRepo = mock(AlertRepositoryPort.class);
        when(alertsRepo.findUnresolvedByBranchProductAndType(3L, 5L, StockAlert.AlertType.LOW_STOCK)).thenReturn(List.of());
        when(branches.getBranchById(3L)).thenReturn(co.com.zenvory.inventario.branch.domain.model.Branch.builder().id(3L).name("Sede").build());
        var svc = new AlertService(alertsRepo, mock(InventoryUseCase.class), products, branches,
                mock(TransferUseCase.class), purchases, mock(org.springframework.transaction.PlatformTransactionManager.class));

        var committedHeavy = co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().branchId(3L).productId(5L)
                .currentQuantity(new BigDecimal("11")).committedQuantity(new BigDecimal("8")).minimumStock(new BigDecimal("5")).build();
        svc.handleLowStockCheck(committedHeavy); // disponible 3 <= 5 -> alerta
        verify(alertsRepo).save(any());

        org.mockito.Mockito.clearInvocations(alertsRepo);
        var plenty = co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().branchId(3L).productId(5L)
                .currentQuantity(new BigDecimal("11")).committedQuantity(BigDecimal.ZERO).minimumStock(new BigDecimal("5")).build();
        svc.handleLowStockCheck(plenty); // disponible 11 > 5 -> sin alerta
        org.mockito.Mockito.verify(alertsRepo, org.mockito.Mockito.never()).save(any());
    }

    private StockAlert lowStockAlert(long id) {
        return new StockAlert(id, 3L, 5L, "Stock bajo", java.time.LocalDateTime.now(), false, null, StockAlert.AlertType.LOW_STOCK, null, null, null);
    }

    private co.com.zenvory.inventario.inventory.domain.model.LocalInventory inv(String current, String committed, String min) {
        return co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().branchId(3L).productId(5L)
                .currentQuantity(new BigDecimal(current)).committedQuantity(new BigDecimal(committed)).minimumStock(new BigDecimal(min)).build();
    }

    @Test
    @DisplayName("al restaurar stock solo se cierran las alertas de STOCK BAJO, no las de solicitud de traslado u otras")
    void restoredClosesOnlyLowStockAlerts() {
        when(inventory.getInventory(3L, 5L)).thenReturn(inv("20", "0", "5"));
        StockAlert low = lowStockAlert(10L);
        when(alerts.findUnresolvedByBranchProductAndType(3L, 5L, StockAlert.AlertType.LOW_STOCK)).thenReturn(List.of(low));
        service.handleRestoredStockCheck(3L, 5L);
        assertThat(low.isResolved()).isTrue();
        verify(alerts, org.mockito.Mockito.never()).findUnresolvedByBranchProductAndType(3L, 5L, StockAlert.AlertType.TRANSFER_REQUEST);
    }

    @Test
    @DisplayName("al restaurar stock no se cierra la alerta si, con lo comprometido, sigue bajo el mínimo")
    void restoredDoesNotCloseWhileStillBelowMinimum() {
        when(inventory.getInventory(3L, 5L)).thenReturn(inv("10", "8", "5"));
        StockAlert low = lowStockAlert(10L);
        when(alerts.findUnresolvedByBranchProductAndType(3L, 5L, StockAlert.AlertType.LOW_STOCK)).thenReturn(List.of(low));
        service.handleRestoredStockCheck(3L, 5L);
        assertThat(low.isResolved()).isFalse();
    }

    @Test
    @DisplayName("el escaneo sigue con las demás filas si una falla, y omite las que ya tienen alerta de stock bajo")
    void scanContinuesAfterAFailureAndSkipsAlerted() {
        var ok = inv("1", "0", "5");
        var broken = co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().branchId(3L).productId(6L)
                .currentQuantity(BigDecimal.ONE).committedQuantity(BigDecimal.ZERO).minimumStock(new BigDecimal("5")).build();
        var alreadyAlerted = co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().branchId(3L).productId(7L)
                .currentQuantity(BigDecimal.ONE).committedQuantity(BigDecimal.ZERO).minimumStock(new BigDecimal("5")).build();
        when(inventory.getLowStockInventories()).thenReturn(List.of(broken, alreadyAlerted, ok));
        when(alerts.findAllUnresolvedByType(StockAlert.AlertType.LOW_STOCK)).thenReturn(List.of(
                new StockAlert(1L, 3L, 7L, "ya", java.time.LocalDateTime.now(), false, null, StockAlert.AlertType.LOW_STOCK, null, null, null)));
        when(products.getProductById(6L)).thenThrow(new RuntimeException("producto roto"));
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("P").build());
        var branches = mock(BranchUseCase.class);
        when(branches.getBranchById(3L)).thenReturn(co.com.zenvory.inventario.branch.domain.model.Branch.builder().id(3L).name("Sede").build());
        when(alerts.findUnresolvedByBranchProductAndType(any(), any(), any())).thenReturn(List.of());
        var svc = new AlertService(alerts, inventory, products, branches, transfers, purchases,
                mock(org.springframework.transaction.PlatformTransactionManager.class));

        svc.scanForAlerts();

        org.mockito.ArgumentCaptor<StockAlert> saved = org.mockito.ArgumentCaptor.forClass(StockAlert.class);
        verify(alerts).save(saved.capture());
        assertThat(saved.getValue().getProductId()).isEqualTo(5L);
        verify(alerts, org.mockito.Mockito.never()).lockForCreation(3L, 7L);
    }

    @Test
    @DisplayName("una alerta de otro tipo abierta no impide crear la alerta de stock bajo, y la creación se hace bajo candado")
    void otherOpenAlertDoesNotSuppressLowStock() {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("P").build());
        var branches = mock(BranchUseCase.class);
        when(branches.getBranchById(3L)).thenReturn(co.com.zenvory.inventario.branch.domain.model.Branch.builder().id(3L).name("Sede").build());
        when(alerts.findUnresolvedByBranchProductAndType(3L, 5L, StockAlert.AlertType.LOW_STOCK)).thenReturn(List.of());
        var svc = new AlertService(alerts, inventory, products, branches, transfers, purchases,
                mock(org.springframework.transaction.PlatformTransactionManager.class));
        svc.handleLowStockCheck(inv("1", "0", "5"));
        org.mockito.InOrder order = org.mockito.Mockito.inOrder(alerts);
        order.verify(alerts).lockForCreation(3L, 5L);
        order.verify(alerts).findUnresolvedByBranchProductAndType(3L, 5L, StockAlert.AlertType.LOW_STOCK);
        order.verify(alerts).save(any());
    }

    @Test
    @DisplayName("resolver una alerta ya resuelta falla ANTES de crear el traslado o la orden (no hay documentos duplicados)")
    void resolvingAnAlreadyResolvedAlertCreatesNothing() {
        StockAlert resolved = StockAlert.create(3L, 5L, "x");
        resolved.resolve(co.com.zenvory.inventario.alert.domain.model.ResolutionType.DISMISSED, null, "ya");
        when(alerts.findByIdForUpdate(2L)).thenReturn(Optional.of(resolved));
        assertThatThrownBy(() -> service.resolveViaTransfer(2L, 9L, 4, 7L, "HIGH"))
                .isInstanceOf(co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException.class);
        assertThatThrownBy(() -> service.resolveViaPurchaseOrder(2L, 3, BigDecimal.TEN, 7L, true, 1L))
                .isInstanceOf(co.com.zenvory.inventario.alert.domain.exception.AlertAlreadyResolvedException.class);
        verify(transfers, org.mockito.Mockito.never()).requestTransfer(any());
        verify(purchases, org.mockito.Mockito.never()).createOrder(any(), org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    @DisplayName("resolver por traslado valida origen, cantidad y prioridad antes de crear nada")
    void transferResolutionValidatesInput() {
        assertThatThrownBy(() -> service.resolveViaTransfer(1L, 3L, 4, 7L, "HIGH")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.resolveViaTransfer(1L, null, 4, 7L, "HIGH")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.resolveViaTransfer(1L, 9L, 0, 7L, "HIGH")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.resolveViaTransfer(1L, 9L, 4, 7L, "urgente")).isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("prioridad");
        verify(transfers, org.mockito.Mockito.never()).requestTransfer(any());
    }

    @Test
    @DisplayName("resolver por compra valida los datos y no atribuye la orden a un usuario por defecto")
    void purchaseResolutionValidatesInput() {
        assertThatThrownBy(() -> service.resolveViaPurchaseOrder(1L, 3, BigDecimal.TEN, null, true, 1L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.resolveViaPurchaseOrder(1L, 3, BigDecimal.ZERO, 7L, true, 1L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.resolveViaPurchaseOrder(1L, 0, BigDecimal.TEN, 7L, true, 1L)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.resolveViaPurchaseOrder(1L, 3, BigDecimal.TEN, 7L, true, null)).isInstanceOf(IllegalArgumentException.class);
        verify(purchases, org.mockito.Mockito.never()).createOrder(any(), org.mockito.ArgumentMatchers.anyBoolean());
    }
}
