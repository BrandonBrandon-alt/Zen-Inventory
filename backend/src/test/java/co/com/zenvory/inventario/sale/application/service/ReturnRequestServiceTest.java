package co.com.zenvory.inventario.sale.application.service;

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
        sale = Sale.create(1L, "Sede", 2L, "Ana", "C", "1", BigDecimal.ZERO,
                List.of(SaleDetail.create(5L, "P", 3, new BigDecimal("25"), BigDecimal.ZERO)));
        when(sales.getSaleById(10L)).thenReturn(sale);
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
}
