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

    @BeforeEach
    void setUp() {
        alerts = mock(AlertRepositoryPort.class);
        products = mock(ProductUseCase.class);
        purchases = mock(PurchaseUseCase.class);
        service = new AlertService(alerts, mock(InventoryUseCase.class), products, mock(BranchUseCase.class),
                mock(TransferUseCase.class), purchases);
        when(alerts.findById(1L)).thenReturn(Optional.of(StockAlert.create(3L, 5L, "Stock bajo")));
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
        StockAlert match = new StockAlert(100L, 3L, 5L, "Solicitud de Traslado pendiente", java.time.LocalDateTime.now(), false,
                null, null, null, null, null);
        StockAlert otherProduct = new StockAlert(101L, 3L, 6L, "Solicitud de Traslado pendiente", java.time.LocalDateTime.now(), false,
                null, null, null, null, null);
        StockAlert lowStock = new StockAlert(102L, 3L, 5L, "Stock bajo", java.time.LocalDateTime.now(), false,
                null, null, null, null, null);
        when(alerts.findActiveAlerts(3L)).thenReturn(List.of(match, otherProduct, lowStock));
        when(alerts.findById(100L)).thenReturn(Optional.of(match));

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
        when(alertsRepo.findUnresolvedByBranchAndProduct(3L, 5L)).thenReturn(List.of());
        when(branches.getBranchById(3L)).thenReturn(co.com.zenvory.inventario.branch.domain.model.Branch.builder().id(3L).name("Sede").build());
        var svc = new AlertService(alertsRepo, mock(InventoryUseCase.class), products, branches,
                mock(TransferUseCase.class), purchases);

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
}
