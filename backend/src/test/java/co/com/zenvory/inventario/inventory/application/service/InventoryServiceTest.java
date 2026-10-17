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
    private LocalInventory row;

    @BeforeEach
    void setUp() {
        repo = mock(LocalInventoryRepositoryPort.class);
        service = new InventoryService(repo, mock(InventoryMovementRepositoryPort.class), mock(ProductUseCase.class),
                mock(UnitOfMeasureUseCase.class), mock(ApplicationEventPublisher.class));
        row = LocalInventory.builder().branchId(1L).productId(2L).currentQuantity(new BigDecimal("5"))
                .committedQuantity(BigDecimal.ZERO).minimumStock(BigDecimal.ZERO).build();
        when(repo.findByBranchAndProductForUpdate(1L, 2L)).thenReturn(Optional.of(row));
        when(repo.findByBranchAndProduct(1L, 2L)).thenReturn(Optional.of(row));
        when(repo.save(any())).thenAnswer(inv -> inv.getArgument(0));
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
}
