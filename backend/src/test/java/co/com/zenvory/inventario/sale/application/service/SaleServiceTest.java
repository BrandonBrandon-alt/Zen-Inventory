package co.com.zenvory.inventario.sale.application.service;

import co.com.zenvory.inventario.sale.domain.model.SalePaymentMethod;
import co.com.zenvory.inventario.alert.application.port.in.AlertUseCase;
import co.com.zenvory.inventario.auth.application.port.out.UserRepositoryPort;
import co.com.zenvory.inventario.auth.domain.model.User;
import co.com.zenvory.inventario.branch.application.port.in.BranchUseCase;
import co.com.zenvory.inventario.branch.domain.model.Branch;
import co.com.zenvory.inventario.catalog.application.port.in.ProductUseCase;
import co.com.zenvory.inventario.catalog.domain.model.Product;
import co.com.zenvory.inventario.inventory.application.port.in.InventoryUseCase;
import co.com.zenvory.inventario.inventory.domain.model.LocalInventory;
import co.com.zenvory.inventario.inventory.domain.model.MovementReason;
import co.com.zenvory.inventario.pricelist.application.port.in.PriceListUseCase;
import co.com.zenvory.inventario.sale.application.port.in.CreateSaleCommand;
import co.com.zenvory.inventario.sale.application.port.out.SaleRepositoryPort;
import co.com.zenvory.inventario.sale.domain.exception.InvalidSaleStateException;
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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@DisplayName("SaleService")
class SaleServiceTest {

    private SaleRepositoryPort repo;
    private InventoryUseCase inventory;
    private ProductUseCase products;
    private PriceListUseCase priceLists;
    private SaleService service;
    private Sale sale;

    @BeforeEach
    void setUp() {
        repo = mock(SaleRepositoryPort.class);
        inventory = mock(InventoryUseCase.class);
        products = mock(ProductUseCase.class);
        priceLists = mock(PriceListUseCase.class);
        BranchUseCase branches = mock(BranchUseCase.class);
        UserRepositoryPort users = mock(UserRepositoryPort.class);
        service = new SaleService(repo, products, inventory, branches, users, priceLists, mock(AlertUseCase.class));

        sale = Sale.create(1L, "Sede", 2L, "Vendedora", "C", "1", SalePaymentMethod.EFECTIVO, null, BigDecimal.ZERO,
                List.of(SaleDetail.create(5L, "P", 2, new BigDecimal("10"), BigDecimal.ZERO, null)));
        when(repo.findByIdForUpdate(7L)).thenReturn(Optional.of(sale));
        when(repo.save(any())).thenAnswer(i -> i.getArgument(0));
        when(branches.getBranchById(1L)).thenReturn(Branch.builder().id(1L).name("Sede").build());
        when(users.findById(9L)).thenReturn(Optional.of(User.builder().id(9L).nombre("Gerente").build()));
        when(inventory.getInventory(any(), any())).thenReturn(LocalInventory.builder().currentQuantity(BigDecimal.TEN).committedQuantity(BigDecimal.ZERO).build());
    }

    private CreateSaleCommand command() {
        return new CreateSaleCommand(1L, 9L, "C", "1", SalePaymentMethod.EFECTIVO, null, null, null,
                List.of(new CreateSaleCommand.Detail(5L, 1, null, null)));
    }

    @Test
    @DisplayName("anular lee la venta con bloqueo y deja en el kardex a quien anuló, no al vendedor original")
    void cancelAttributesToActor() {
        service.cancelSale(7L, "error", null, 9L);
        assertThat(sale.getStatus()).isEqualTo(SaleStatus.CANCELED);
        verify(inventory).addStock(eq(1L), eq(5L), any(), any(), eq(MovementReason.DEVOLUCION), eq(9L), any(), any(), any(), any(), any());
        verify(repo, never()).findById(any());
    }

    @Test
    @DisplayName("updateSaleStatus solo admite RETURNED: no se puede des-anular ni cambiar el estado a mano")
    void updateStatusOnlyReturned() {
        assertThatThrownBy(() -> service.updateSaleStatus(7L, SaleStatus.COMPLETED)).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> service.updateSaleStatus(7L, SaleStatus.CANCELED)).isInstanceOf(IllegalArgumentException.class);
        service.updateSaleStatus(7L, SaleStatus.RETURNED);
        assertThat(sale.getStatus()).isEqualTo(SaleStatus.RETURNED);
    }

    @Test
    @DisplayName("una venta anulada no puede pasar a devuelta")
    void canceledCannotBeReturned() {
        service.cancelSale(7L, "x", null, 9L);
        assertThatThrownBy(() -> service.updateSaleStatus(7L, SaleStatus.RETURNED)).isInstanceOf(InvalidSaleStateException.class);
    }

    private CreateSaleCommand commandWithList(Long globalList, Long lineList) {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("P").salePrice(new BigDecimal("100")).active(true).build());
        return new CreateSaleCommand(1L, 9L, "C", "1", SalePaymentMethod.EFECTIVO, null, null, globalList,
                List.of(new CreateSaleCommand.Detail(5L, 1, null, lineList)));
    }

    @Test
    @DisplayName("la línea guarda la lista de la que salió su precio (la de la línea manda sobre la global)")
    void lineRemembersItsPriceList() {
        when(priceLists.getPriceForProduct(3L, 5L)).thenReturn(Optional.of(new BigDecimal("80")));
        SaleDetail line = service.execute(commandWithList(2L, 3L)).getDetails().get(0);
        assertThat(line.getUnitPriceApplied()).isEqualByComparingTo("80");
        assertThat(line.getPriceListId()).isEqualTo(3L);
    }

    @Test
    @DisplayName("sin precio en la lista se vende al precio base y la línea no queda atribuida a esa lista")
    void basePriceHasNoPriceList() {
        when(priceLists.getPriceForProduct(2L, 5L)).thenReturn(Optional.empty());
        SaleDetail line = service.execute(commandWithList(2L, null)).getDetails().get(0);
        assertThat(line.getUnitPriceApplied()).isEqualByComparingTo("100");
        assertThat(line.getPriceListId()).isNull();
    }

    @Test
    @DisplayName("la respuesta de la venta informa la lista de cada línea")
    void responseExposesPriceList() {
        when(priceLists.getPriceForProduct(2L, 5L)).thenReturn(Optional.of(new BigDecimal("80")));
        var response = co.com.zenvory.inventario.sale.infrastructure.adapter.in.web.SaleResponse.fromDomain(service.execute(commandWithList(2L, null)));
        assertThat(response.details().get(0).priceListId()).isEqualTo(2L);
    }

    @Test
    @DisplayName("vender un producto desactivado se rechaza con un mensaje claro")
    void inactiveProductRejected() {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("Viejo").salePrice(BigDecimal.TEN).active(false).build());
        assertThatThrownBy(() -> service.execute(command())).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("desactivado");
        verify(repo, never()).save(any());
    }

    @Test
    @DisplayName("vender un producto sin precio se rechaza con un mensaje claro, no con un error interno")
    void missingPriceRejected() {
        when(products.getProductById(5L)).thenReturn(Product.builder().id(5L).name("Sin precio").salePrice(null).active(true).build());
        assertThatThrownBy(() -> service.execute(command())).isInstanceOf(IllegalArgumentException.class).hasMessageContaining("precio");
    }
}
