package co.com.zenvory.inventario.sale.application.service;

import co.com.zenvory.inventario.sale.domain.model.SalePaymentMethod;
import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.sale.application.port.in.CreateReturnRequestCommand;
import co.com.zenvory.inventario.sale.application.port.in.SaleManagementUseCase;
import co.com.zenvory.inventario.sale.application.port.out.ReturnRequestRepositoryPort;
import co.com.zenvory.inventario.sale.domain.exception.InvalidReturnOperationException;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequest;
import co.com.zenvory.inventario.sale.domain.model.ReturnRequestDetail;
import co.com.zenvory.inventario.sale.domain.model.Sale;
import co.com.zenvory.inventario.sale.domain.model.SaleDetail;
import co.com.zenvory.inventario.sale.domain.model.SaleStatus;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("ReturnRequestService — ventas anuladas y costo")
class ReturnRequestServiceTest {

    private ReturnRequestRepositoryPort repo;
    private SaleManagementUseCase sales;
    private InventoryUseCase inventory;
    private ReturnRequestService service;
    private Sale sale;

    @BeforeEach
    void setUp() {
        repo = mock(ReturnRequestRepositoryPort.class);
        sales = mock(SaleManagementUseCase.class);
        inventory = mock(InventoryUseCase.class);
        service = new ReturnRequestService(repo, sales, inventory, mock(AlertUseCase.class));
        sale = saleWith(BigDecimal.ZERO, line(100L, 3, "25", "0"));
        when(sales.getSaleForUpdate(10L)).thenReturn(sale);
        when(repo.findBySaleId(10L)).thenReturn(List.of());
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private static SaleDetail line(Long id, int quantity, String price, String discount) {
        return new SaleDetail(id, 5L, "P", quantity, new BigDecimal(price), new BigDecimal(discount), null);
    }

    private static Sale saleWith(BigDecimal globalDiscount, SaleDetail... lines) {
        return Sale.create(1L, "Sede", 2L, "Ana", "C", "1", SalePaymentMethod.EFECTIVO, null, globalDiscount, List.of(lines));
    }

    private static CreateReturnRequestCommand.Detail item(Long saleDetailId, int quantity) {
        return new CreateReturnRequestCommand.Detail(saleDetailId, quantity, "d");
    }

    private static CreateReturnRequestCommand request(CreateReturnRequestCommand.Detail... items) {
        return new CreateReturnRequestCommand(10L, 1L, 2L, "m", List.of(items));
    }

    private ReturnRequest pending() {
        ReturnRequest request = ReturnRequest.create(10L, 1L, 2L, "m",
                List.of(ReturnRequestDetail.create(100L, 5L, 1, "d", new BigDecimal("25"))));
        when(repo.findByIdForUpdate(77L)).thenReturn(Optional.of(request));
        return request;
    }

    @Test
    @DisplayName("no se puede solicitar la devolución de una venta anulada")
    void cannotRequestOnCanceledSale() {
        sale.cancel("error");
        assertThatThrownBy(() -> service.createRequest(request(item(100L, 1)))).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("no se puede aprobar la devolución de una venta anulada: no se repone stock dos veces")
    void cannotApproveOnCanceledSale() {
        pending();
        sale.cancel("error");
        assertThatThrownBy(() -> service.approveRequest(77L, 9L, "ok")).isInstanceOf(InvalidReturnOperationException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("al aprobar, el stock repuesto no lleva costo (el precio de venta no debe alterar el costo promedio)")
    void approveRestocksWithoutCost() {
        pending();
        service.approveRequest(77L, 9L, "ok");
        verify(inventory).addStock(any(), any(), any(), any(), any(), any(), any(), any(), org.mockito.ArgumentMatchers.isNull(), any(), any());
        verify(sales).updateSaleStatus(10L, SaleStatus.RETURNED);
    }

    @Test
    @DisplayName("una solicitud ya aprobada no se aprueba otra vez: el stock no se repone dos veces")
    void cannotApproveTwice() {
        pending().approve(8L, "ok");
        assertThatThrownBy(() -> service.approveRequest(77L, 9L, "ok")).isInstanceOf(InvalidReturnOperationException.class);
        verify(inventory, never()).addStock(any(), any(), any(), any(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("una solicitud ya aprobada no se puede rechazar: su stock ya volvió")
    void cannotRejectApproved() {
        pending().approve(8L, "ok");
        assertThatThrownBy(() -> service.rejectRequest(77L, 9L, "no")).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("una solicitud sin ítems se rechaza con un error de negocio, no con un 500")
    void requestWithoutItemsRejected() {
        assertThatThrownBy(() -> service.createRequest(new CreateReturnRequestCommand(10L, 1L, 2L, "m", null))).isInstanceOf(InvalidReturnOperationException.class);
        assertThatThrownBy(() -> service.createRequest(new CreateReturnRequestCommand(10L, 1L, 2L, "m", List.of()))).isInstanceOf(InvalidReturnOperationException.class);
    }

    @Test
    @DisplayName("un ítem sin cantidad se rechaza con un error de negocio, no con un 500")
    void itemWithoutQuantityRejected() {
        assertThatThrownBy(() -> service.createRequest(request(new CreateReturnRequestCommand.Detail(100L, null, "d")))).isInstanceOf(InvalidReturnOperationException.class);
    }

    @Test
    @DisplayName("una cantidad negativa no se compensa con otro ítem de la misma línea")
    void negativeQuantityRejectedEvenIfSumIsPositive() {
        assertThatThrownBy(() -> service.createRequest(request(item(100L, -1), item(100L, 3)))).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("el detalle guardado apunta a la línea vendida y conserva su producto")
    void detailKeepsSaleLineAndProduct() {
        ReturnRequestDetail saved = service.createRequest(request(item(100L, 1))).getDetails().get(0);
        assertThat(saved.getSaleDetailId()).isEqualTo(100L);
        assertThat(saved.getProductId()).isEqualTo(5L);
    }

    @Test
    @DisplayName("una línea que no es de esta venta se rechaza")
    void lineFromAnotherSaleRejected() {
        assertThatThrownBy(() -> service.createRequest(request(item(999L, 1)))).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("un ítem sin línea de venta se rechaza con un error de negocio, no con un 500")
    void itemWithoutLineRejected() {
        assertThatThrownBy(() -> service.createRequest(request(new CreateReturnRequestCommand.Detail(null, 1, "d"))))
                .isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("ítems repetidos de una línea se suman: dos de 3 sobre una línea de 3 se rechaza")
    void duplicatedItemsAreSummed() {
        assertThatThrownBy(() -> service.createRequest(request(item(100L, 3), item(100L, 3)))).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("ítems repetidos dentro del tope se unen en un solo detalle")
    void duplicatedItemsWithinLimitAreMerged() {
        ReturnRequest saved = service.createRequest(request(item(100L, 1), item(100L, 2)));
        assertThat(saved.getDetails()).hasSize(1);
        assertThat(saved.getDetails().get(0).getQuantity()).isEqualTo(3);
    }

    @Test
    @DisplayName("el tope es por línea: 3 de una línea de 2 se rechaza aunque el producto sume 4 en la venta")
    void limitIsPerLine() {
        when(sales.getSaleForUpdate(10L)).thenReturn(saleWith(BigDecimal.ZERO, line(100L, 2, "100", "10"), line(101L, 2, "100", "0")));
        assertThatThrownBy(() -> service.createRequest(request(item(100L, 3)))).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("se reembolsa lo pagado en esa línea, no el promedio: 90 en la de 10 % y 100 en la otra")
    void refundIsThePriceOfThatLine() {
        when(sales.getSaleForUpdate(10L)).thenReturn(saleWith(BigDecimal.ZERO, line(100L, 2, "100", "10"), line(101L, 2, "100", "0")));
        List<ReturnRequestDetail> details = service.createRequest(request(item(100L, 1), item(101L, 1))).getDetails();
        assertThat(details.get(0).getUnitPricePaid()).isEqualByComparingTo("90");
        assertThat(details.get(1).getUnitPricePaid()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("lo ya devuelto consume solo su línea; la otra línea del producto sigue disponible")
    void previousReturnsCountPerLine() {
        when(sales.getSaleForUpdate(10L)).thenReturn(saleWith(BigDecimal.ZERO, line(100L, 2, "100", "10"), line(101L, 2, "100", "0")));
        when(repo.findBySaleId(10L)).thenReturn(List.of(ReturnRequest.create(10L, 1L, 2L, "m",
                List.of(ReturnRequestDetail.create(100L, 5L, 2, "d", new BigDecimal("90"))))));
        assertThatThrownBy(() -> service.createRequest(request(item(100L, 1)))).isInstanceOf(InvalidReturnOperationException.class);
        assertThat(service.createRequest(request(item(101L, 2))).getDetails().get(0).getQuantity()).isEqualTo(2);
    }

    @Test
    @DisplayName("una solicitud rechazada no consume unidades de la línea")
    void rejectedRequestDoesNotCount() {
        ReturnRequest rejected = ReturnRequest.create(10L, 1L, 2L, "m",
                List.of(ReturnRequestDetail.create(100L, 5L, 3, "d", new BigDecimal("25"))));
        rejected.reject(9L, "no");
        when(repo.findBySaleId(10L)).thenReturn(List.of(rejected));
        assertThat(service.createRequest(request(item(100L, 3))).getDetails().get(0).getQuantity()).isEqualTo(3);
    }

    @Test
    @DisplayName("el precio devuelto es lo realmente pagado: 100 con 20 % de línea y 10 % global = 72")
    void returnPriceIncludesDiscounts() {
        when(sales.getSaleForUpdate(10L)).thenReturn(saleWith(new BigDecimal("10"), line(100L, 3, "100", "20")));
        assertThat(service.createRequest(request(item(100L, 1))).getDetails().get(0).getUnitPricePaid()).isEqualByComparingTo("72");
    }
}
