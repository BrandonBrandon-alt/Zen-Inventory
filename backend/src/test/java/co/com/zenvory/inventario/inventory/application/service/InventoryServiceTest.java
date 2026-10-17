package co.com.zenvory.inventario.inventory.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.application.port.in.UnitOfMeasureUseCase;
import co.com.zenvory.inventario.inventory.application.port.out.InventoryMovementRepositoryPort;
import co.com.zenvory.inventario.inventory.application.port.out.LocalInventoryRepositoryPort;
import co.com.zenvory.inventario.inventory.domain.exception.InsufficientStockException;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("InventoryService — bloqueo del saldo")
class InventoryServiceTest {

    private LocalInventoryRepositoryPort repo;
    private InventoryService service;
    private ProductUseCase products;
    private UnitOfMeasureUseCase units;
    private ApplicationEventPublisher publisher;
    private LocalInventory row;

    @BeforeEach
    void setUp() {
        repo = mock(LocalInventoryRepositoryPort.class);
        products = mock(ProductUseCase.class);
        units = mock(UnitOfMeasureUseCase.class);
        publisher = mock(ApplicationEventPublisher.class);
        service = new InventoryService(repo, mock(InventoryMovementRepositoryPort.class), products, units, publisher);
        row = LocalInventory.builder().branchId(1L).productId(2L).currentQuantity(new BigDecimal("5"))
                .committedQuantity(BigDecimal.ZERO).minimumStock(BigDecimal.ZERO).build();
        when(repo.findByBranchAndProductForUpdate(1L, 2L)).thenReturn(Optional.of(row));
        when(repo.findByBranchAndProduct(1L, 2L)).thenReturn(Optional.of(row));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(products.getProductById(any())).thenReturn(co.com.zenvory.inventario.catalog.domain.model.Product.builder().id(2L).name("P").unitId(1L).build());
    }

    private void verifyOnlyLockedRead() {
        verify(repo).findByBranchAndProductForUpdate(1L, 2L);
        verify(repo, never()).findByBranchAndProduct(anyLong(), anyLong());
    }

    @Test
    @DisplayName("retirar lee el saldo con bloqueo (si no, dos ventas simultáneas venden las mismas unidades)")
    void withdrawLocks() {
        service.withdrawStock(1L, 2L, "P", new BigDecimal("2"), null, MovementReason.VENTA, 9L, null, null, null, null);
        verifyOnlyLockedRead();
        assertThat(row.getCurrentQuantity()).isEqualByComparingTo("3");
    }

    @Test
    @DisplayName("retirar más de lo disponible sigue siendo error")
    void withdrawInsufficient() {
        assertThatThrownBy(() -> service.withdrawStock(1L, 2L, "P", new BigDecimal("6"), null, MovementReason.VENTA, 9L, null, null, null, null))
                .isInstanceOf(InsufficientStockException.class);
    }

    @Test
    @DisplayName("ingresar lee el saldo con bloqueo (si no, dos ingresos simultáneos pierden uno)")
    void addLocks() {
        service.addStock(1L, 2L, new BigDecimal("4"), null, MovementReason.COMPRA, 9L, null, null, null, null, null);
        verifyOnlyLockedRead();
        assertThat(row.getCurrentQuantity()).isEqualByComparingTo("9");
    }

    @Test
    @DisplayName("reservar y liberar leen el saldo con bloqueo")
    void reserveAndReleaseLock() {
        service.reserveStock(1L, 2L, new BigDecimal("2"));
        assertThat(row.getCommittedQuantity()).isEqualByComparingTo("2");
        service.releaseStock(1L, 2L, new BigDecimal("2"));
        assertThat(row.getCommittedQuantity()).isEqualByComparingTo("0");
        org.mockito.Mockito.verify(repo, org.mockito.Mockito.times(2)).findByBranchAndProductForUpdate(1L, 2L);
        verify(repo, never()).findByBranchAndProduct(anyLong(), anyLong());
    }

    @Test
    @DisplayName("cambiar el stock mínimo también bloquea la fila")
    void minimumLocks() {
        service.updateMinimumStock(1L, 2L, new BigDecimal("1"));
        verifyOnlyLockedRead();
    }

    @Test
    @DisplayName("sin fila previa, el primer ingreso crea el saldo desde cero")
    void firstAddCreatesRow() {
        when(repo.findByBranchAndProductForUpdate(1L, 3L)).thenReturn(Optional.empty());
        service.addStock(1L, 3L, new BigDecimal("4"), null, MovementReason.COMPRA, 9L, null, null, null, null, null);
        org.mockito.ArgumentCaptor<LocalInventory> saved = org.mockito.ArgumentCaptor.forClass(LocalInventory.class);
        verify(repo).save(saved.capture());
        assertThat(saved.getValue().getCurrentQuantity()).isEqualByComparingTo("4");
    }

    @Test
    @DisplayName("antes de bloquear se garantiza que la fila exista (dos primeras operaciones simultáneas no insertan dos veces)")
    void rowIsEnsuredBeforeLocking() {
        service.addStock(1L, 2L, new BigDecimal("1"), null, MovementReason.COMPRA, 9L, null, null, null, null, null);
        org.mockito.InOrder order = org.mockito.Mockito.inOrder(repo);
        order.verify(repo).ensureExists(1L, 2L);
        order.verify(repo).findByBranchAndProductForUpdate(1L, 2L);
    }

    @Test
    @DisplayName("una unidad que no está configurada para el producto es error, no se asume la base")
    void unknownUnitRejected() {
        when(units.getUnitsByProduct(2L)).thenReturn(java.util.List.of());
        assertThatThrownBy(() -> service.addStock(1L, 2L, new BigDecimal("5"), 99L, MovementReason.COMPRA, 9L, null, null, null, null, null))
                .isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("reportar en la unidad base del producto no convierte")
    void baseUnitNeedsNoConversion() {
        service.addStock(1L, 2L, new BigDecimal("5"), 1L, MovementReason.COMPRA, 9L, null, null, null, null, null);
        assertThat(row.getCurrentQuantity()).isEqualByComparingTo("10");
    }

    @Test
    @DisplayName("una unidad configurada multiplica por su factor")
    void configuredUnitConverts() {
        var box = co.com.zenvory.inventario.catalog.domain.model.ProductUnit.builder().unitId(7L).conversionFactor(new BigDecimal("12")).build();
        when(units.getUnitsByProduct(2L)).thenReturn(java.util.List.of(box));
        service.addStock(1L, 2L, new BigDecimal("2"), 7L, MovementReason.COMPRA, 9L, null, null, null, null, null);
        assertThat(row.getCurrentQuantity()).isEqualByComparingTo("29");
    }

    @Test
    @DisplayName("el costo promedio se recalcula con el producto bloqueado y solo se actualiza ese campo")
    void averageCostLocksProductAndUpdatesOnlyCost() {
        var product = co.com.zenvory.inventario.catalog.domain.model.Product.builder().id(2L).name("P").unitId(1L).averageCost(new BigDecimal("10")).build();
        when(products.getProductForCostUpdate(2L)).thenReturn(product);
        when(repo.sumQuantityByProductId(2L)).thenReturn(new BigDecimal("10"));
        service.addStock(1L, 2L, new BigDecimal("10"), null, MovementReason.COMPRA, 9L, null, null, new BigDecimal("20"), null, null);
        verify(products).updateAverageCost(2L, new BigDecimal("15.00"));
        verify(products, never()).updateProduct(any(), any());
    }

    @Test
    @DisplayName("un stock mínimo negativo se rechaza")
    void negativeMinimumRejected() {
        assertThatThrownBy(() -> service.updateMinimumStock(1L, 2L, new BigDecimal("-1"))).isInstanceOf(IllegalArgumentException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("un producto inexistente no crea saldo ni mueve stock")
    void unknownProductRejected() {
        when(products.getProductById(99L)).thenThrow(new co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException(99L));
        assertThatThrownBy(() -> service.addStock(1L, 99L, BigDecimal.ONE, null, MovementReason.COMPRA, 9L, null, null, null, null, null))
                .isInstanceOf(co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException.class);
        assertThatThrownBy(() -> service.reserveStock(1L, 99L, BigDecimal.ONE)).isInstanceOf(co.com.zenvory.inventario.catalog.domain.exception.ProductNotFoundException.class);
        verify(repo, never()).ensureExists(any(), any());
    }

    @Test
    @DisplayName("sin mínimo definido no se publican eventos de alerta en cada movimiento")
    void noEventsWithoutMinimum() {
        service.withdrawStock(1L, 2L, "P", BigDecimal.ONE, null, MovementReason.VENTA, 9L, null, null, null, null);
        service.addStock(1L, 2L, BigDecimal.ONE, null, MovementReason.COMPRA, 9L, null, null, null, null, null);
        verify(publisher, never()).publishEvent(any(Object.class));
    }

    @Test
    @DisplayName("con mínimo, retirar hasta quedar en o bajo él publica la alerta; lo comprometido cuenta como no disponible")
    void eventsUseAvailableStock() {
        row.setMinimumStock(new BigDecimal("3"));
        row.setCommittedQuantity(new BigDecimal("2"));
        service.withdrawStock(1L, 2L, "P", BigDecimal.ONE, null, MovementReason.VENTA, 9L, null, null, null, null); // 4 actual, 2 comprometido -> disponible 2 <= 3
        verify(publisher).publishEvent(any(co.com.zenvory.inventario.inventory.domain.event.StockLevelDroppedEvent.class));
    }

    @Test
    @DisplayName("ingresar stock NO cierra la alerta si, descontando lo comprometido, sigue bajo el mínimo")
    void restoredEventIgnoresCommittedStock() {
        row.setCurrentQuantity(new BigDecimal("10"));
        row.setMinimumStock(new BigDecimal("5"));
        row.setCommittedQuantity(new BigDecimal("8"));
        service.addStock(1L, 2L, BigDecimal.ONE, null, MovementReason.COMPRA, 9L, null, null, null, null, null); // 11 actual, disponible 3 <= 5
        verify(publisher, never()).publishEvent(any(co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent.class));
        row.setCommittedQuantity(BigDecimal.ZERO); // ahora disponible 11 > 5
        service.addStock(1L, 2L, BigDecimal.ONE, null, MovementReason.COMPRA, 9L, null, null, null, null, null);
        verify(publisher).publishEvent(any(co.com.zenvory.inventario.inventory.domain.event.StockLevelRestoredEvent.class));
    }

    @Test
    @DisplayName("el listado enriquecido hace una sola consulta de productos y omite los que ya no existen")
    void enrichedListSingleProductQuery() {
        var other = co.com.zenvory.inventario.inventory.domain.model.LocalInventory.builder().id(5L).branchId(1L).productId(77L)
                .currentQuantity(BigDecimal.ONE).minimumStock(BigDecimal.ZERO).build();
        when(repo.findByBranchId(1L)).thenReturn(java.util.List.of(row, other));
        when(products.getAllProducts()).thenReturn(java.util.List.of(co.com.zenvory.inventario.catalog.domain.model.Product.builder().id(2L).name("P").build()));
        assertThat(service.getEnrichedInventoryByBranch(1L)).hasSize(1);
        verify(products, never()).getProductById(77L);
    }
}
