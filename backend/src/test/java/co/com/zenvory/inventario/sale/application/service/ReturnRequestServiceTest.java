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
        sale = Sale.create(1L, "Sede", 2L, "Ana", "C", "1", SalePaymentMethod.EFECTIVO, null, BigDecimal.ZERO,
                List.of(SaleDetail.create(5L, "P", 3, new BigDecimal("25"), BigDecimal.ZERO)));
        when(sales.getSaleForUpdate(10L)).thenReturn(sale);
        when(repo.findBySaleId(10L)).thenReturn(List.of());
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    private CreateReturnRequestCommand command() {
        return new CreateReturnRequestCommand(10L, 1L, 2L, "motivo",
                List.of(new CreateReturnRequestCommand.Detail(5L, 1, "defecto", null)));
    }

    private ReturnRequest pending() {
        ReturnRequest request = ReturnRequest.create(10L, 1L, 2L, "m",
                List.of(ReturnRequestDetail.create(5L, 1, "d", new BigDecimal("25"))));
        when(repo.findById(77L)).thenReturn(Optional.of(request));
        return request;
    }

    @Test
    @DisplayName("no se puede solicitar la devolución de una venta anulada")
    void cannotRequestOnCanceledSale() {
        sale.cancel("error");
        assertThatThrownBy(() -> service.createRequest(command())).isInstanceOf(InvalidReturnOperationException.class);
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
    @DisplayName("líneas repetidas del mismo producto en la solicitud se suman: dos de 3 sobre una venta de 3 se rechaza")
    void duplicatedItemsAreSummed() {
        CreateReturnRequestCommand twice = new CreateReturnRequestCommand(10L, 1L, 2L, "m", List.of(
                new CreateReturnRequestCommand.Detail(5L, 3, "a", null), new CreateReturnRequestCommand.Detail(5L, 3, "b", null)));
        assertThatThrownBy(() -> service.createRequest(twice)).isInstanceOf(InvalidReturnOperationException.class);
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("líneas repetidas dentro del tope se unen en un solo detalle")
    void duplicatedItemsWithinLimitAreMerged() {
        CreateReturnRequestCommand twice = new CreateReturnRequestCommand(10L, 1L, 2L, "m", List.of(
                new CreateReturnRequestCommand.Detail(5L, 1, "a", null), new CreateReturnRequestCommand.Detail(5L, 2, "b", null)));
        ReturnRequest saved = service.createRequest(twice);
        org.assertj.core.api.Assertions.assertThat(saved.getDetails()).hasSize(1);
        org.assertj.core.api.Assertions.assertThat(saved.getDetails().get(0).getQuantity()).isEqualTo(3);
    }

    @Test
    @DisplayName("una venta con el mismo producto en dos líneas (distinto descuento) sí admite devolución")
    void saleWithDuplicateProductLinesCanBeReturned() {
        Sale split = Sale.create(1L, "Sede", 2L, "Ana", "C", "1", SalePaymentMethod.EFECTIVO, null, BigDecimal.ZERO, List.of(
                SaleDetail.create(5L, "P", 2, new BigDecimal("100"), new BigDecimal("10")),
                SaleDetail.create(5L, "P", 2, new BigDecimal("100"), BigDecimal.ZERO)));
        when(sales.getSaleForUpdate(10L)).thenReturn(split);
        CreateReturnRequestCommand ok = new CreateReturnRequestCommand(10L, 1L, 2L, "m",
                List.of(new CreateReturnRequestCommand.Detail(5L, 4, "d", null)));
        org.assertj.core.api.Assertions.assertThat(service.createRequest(ok).getDetails().get(0).getQuantity()).isEqualTo(4);
    }

    @Test
    @DisplayName("el precio devuelto es lo realmente pagado: 100 con 20 % de línea y 10 % global = 72")
    void returnPriceIncludesDiscounts() {
        Sale discounted = Sale.create(1L, "Sede", 2L, "Ana", "C", "1", SalePaymentMethod.EFECTIVO, null, new BigDecimal("10"),
                List.of(SaleDetail.create(5L, "P", 3, new BigDecimal("100"), new BigDecimal("20"))));
        when(sales.getSaleForUpdate(10L)).thenReturn(discounted);
        CreateReturnRequestCommand cmd = new CreateReturnRequestCommand(10L, 1L, 2L, "m",
                List.of(new CreateReturnRequestCommand.Detail(5L, 1, "d", null)));
        org.assertj.core.api.Assertions.assertThat(service.createRequest(cmd).getDetails().get(0).getUnitPricePaid()).isEqualByComparingTo("72");
    }
}
