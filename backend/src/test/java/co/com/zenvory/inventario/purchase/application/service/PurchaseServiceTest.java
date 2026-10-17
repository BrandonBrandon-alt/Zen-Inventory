package co.com.zenvory.inventario.purchase.application.service;

import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.purchase.application.port.in.PurchaseUseCase.ItemReceiptInfo;
import co.com.zenvory.inventario.purchase.application.port.out.PurchaseRepositoryPort;
import co.com.zenvory.inventario.purchase.domain.exception.InvalidPurchaseStateException;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrder;
import co.com.zenvory.inventario.purchase.domain.model.PurchaseOrderDetail;
import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("PurchaseService — recepción")
class PurchaseServiceTest {

    private PurchaseRepositoryPort repo;
    private InventoryUseCase inventory;
    private PurchaseService service;
    private PurchaseOrder order;

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    private static ItemReceiptInfo qty(String v) { return new ItemReceiptInfo(bd(v), null); }

    @BeforeEach
    void setUp() {
        repo = mock(PurchaseRepositoryPort.class);
        inventory = mock(InventoryUseCase.class);
        ProductUseCase products = mock(ProductUseCase.class);
        when(products.getProductById(any())).thenReturn(Product.builder().name("P").averageCost(bd("10")).build());
        service = new PurchaseService(repo, inventory, products);
        // Línea 1: 10 uds a 100 con 20 % de descuento; línea 2: 5 uds a 50 sin descuento.
        order = PurchaseOrder.create(1L, 2L, 3L, null, null, List.of(
                new PurchaseOrderDetail(11L, 5L, bd("10"), bd("100"), bd("20"), null),
                new PurchaseOrderDetail(12L, 6L, bd("5"), bd("50"), null, null)), true);
        when(repo.findById(1L)).thenReturn(Optional.of(order));
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    @DisplayName("una orden sin aprobar no se puede recibir (no entra stock sin visto bueno del gerente)")
    void cannotReceiveUnapprovedOrder() {
        PurchaseOrder awaiting = PurchaseOrder.create(1L, 2L, 3L, null, null,
                List.of(new PurchaseOrderDetail(11L, 5L, bd("10"), bd("100"), null, null)), false);
        assertThat(awaiting.getReceptionStatus()).isEqualTo(ReceptionStatus.AWAITING_APPROVAL);
        when(repo.findById(2L)).thenReturn(Optional.of(awaiting));
        assertThatThrownBy(() -> service.receiveOrder(2L, 9L, Map.of(11L, qty("1")))).isInstanceOf(InvalidPurchaseStateException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("el costo que entra al promedio es el precio con el descuento de la línea")
    void costIncludesDiscount() {
        service.receiveOrder(1L, 9L, Map.of(11L, qty("10")));
        verify(inventory).addStock(any(), eq(5L), eq(bd("10")), any(), any(), any(), any(), any(), eq(bd("80.0000")), any(), any());
    }

    @Test
    @DisplayName("la cantidad recibida se acumula y no puede superar lo pedido")
    void receivedQuantityAccumulatesAndIsCapped() {
        service.receiveOrder(1L, 9L, Map.of(11L, qty("6")));
        assertThat(order.getDetails().get(0).getReceivedQuantity()).isEqualByComparingTo("6");
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(11L, qty("5")))).isInstanceOf(IllegalArgumentException.class);
        assertThat(order.getDetails().get(0).getReceivedQuantity()).isEqualByComparingTo("6");
    }

    @Test
    @DisplayName("la sobrerrecepción se rechaza antes de mover cualquier stock (ni siquiera de otras líneas)")
    void overReceiptMovesNoStock() {
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(12L, qty("5"), 11L, qty("11")))).isInstanceOf(IllegalArgumentException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("una línea ajena a la orden se rechaza")
    void foreignLineRejected() {
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(999L, qty("1")))).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    @DisplayName("parcial y luego el resto: la orden queda RECEIVED_PARTIAL y después RECEIVED_TOTAL")
    void partialThenTotal() {
        service.receiveOrder(1L, 9L, Map.of(11L, qty("10"), 12L, qty("2")));
        assertThat(order.getReceptionStatus()).isEqualTo(ReceptionStatus.RECEIVED_PARTIAL);
        service.receiveOrder(1L, 9L, Map.of(12L, qty("3")));
        assertThat(order.getReceptionStatus()).isEqualTo(ReceptionStatus.RECEIVED_TOTAL);
    }

    @Test
    @DisplayName("una orden totalmente recibida no se vuelve a recibir")
    void totalIsFinal() {
        service.receiveOrder(1L, 9L, Map.of(11L, qty("10"), 12L, qty("5")));
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(11L, qty("1")))).isInstanceOf(InvalidPurchaseStateException.class);
    }

    @Test
    @DisplayName("una recepción vacía, en ceros o negativa se rechaza: no cambia el estado de la orden")
    void emptyOrNegativeReceiptRejected() {
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of())).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(11L, qty("0")))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(11L, qty("-1"), 12L, qty("2")))).isInstanceOf(IllegalArgumentException.class);
        assertThat(order.getReceptionStatus()).isEqualTo(ReceptionStatus.PENDING);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("una línea en cero es válida si otra trae cantidad")
    void zeroLineAllowedWhenAnotherHasQuantity() {
        service.receiveOrder(1L, 9L, Map.of(11L, qty("0"), 12L, qty("2")));
        assertThat(order.getDetails().get(1).getReceivedQuantity()).isEqualByComparingTo("2");
    }

    @Test
    @DisplayName("no se admite unidad alterna al recibir: cantidad y costo van en la unidad base")
    void alternateUnitRejected() {
        assertThatThrownBy(() -> service.receiveOrder(1L, 9L, Map.of(11L, new ItemReceiptInfo(bd("1"), 5L))))
                .isInstanceOf(IllegalArgumentException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("una orden aprobada (PENDING) se puede recibir sin marcarla en tránsito: es el flujo del Next")
    void pendingOrderCanBeReceived() {
        assertThat(order.getReceptionStatus()).isEqualTo(ReceptionStatus.PENDING);
        service.receiveOrder(1L, 9L, Map.of(11L, qty("10"), 12L, qty("5")));
        assertThat(order.getReceptionStatus()).isEqualTo(ReceptionStatus.RECEIVED_TOTAL);
    }

    @Test
    @DisplayName("aprobar la excepción dos veces no pisa quién la aprobó primero")
    void approveExceptionOnlyOnce() {
        order.approveException(100L);
        assertThatThrownBy(() -> order.approveException(200L)).isInstanceOf(InvalidPurchaseStateException.class);
    }

    @Test
    @DisplayName("el descuento debe estar entre 0 y 100 al crear una línea")
    void discountMustBeInRange() {
        assertThatThrownBy(() -> PurchaseOrderDetail.create(5L, bd("1"), bd("10"), bd("150"))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> PurchaseOrderDetail.create(5L, bd("1"), bd("10"), bd("-1"))).isInstanceOf(IllegalArgumentException.class);
        assertThat(PurchaseOrderDetail.create(5L, bd("1"), bd("10"), bd("100")).effectiveUnitPrice()).isEqualByComparingTo("0");
    }
}
