package co.com.zenvory.inventario.sale.domain.model;

import co.com.zenvory.inventario.sale.domain.exception.InvalidSaleStateException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Sale — anulación y devolución")
class SaleTest {

    private Sale sale() {
        return Sale.create(1L, "Sede", 2L, "Ana", "Cliente", "123", BigDecimal.ZERO,
                List.of(SaleDetail.create(5L, "P", 2, new BigDecimal("10"), BigDecimal.ZERO)));
    }

    @Test
    @DisplayName("una venta completada se anula con motivo")
    void cancelOk() {
        Sale sale = sale();
        sale.cancel("error de digitación");
        assertThat(sale.getStatus()).isEqualTo(SaleStatus.CANCELED);
    }

    @Test
    @DisplayName("no se anula dos veces (409, no 500)")
    void cancelTwice() {
        Sale sale = sale();
        sale.cancel("x");
        assertThatThrownBy(() -> sale.cancel("y")).isInstanceOf(InvalidSaleStateException.class);
    }

    @Test
    @DisplayName("una venta con devolución aprobada ya no se puede anular: se repondría el stock dos veces")
    void cannotCancelReturnedSale() {
        Sale sale = sale();
        sale.markAsReturned();
        assertThatThrownBy(() -> sale.cancel("x")).isInstanceOf(InvalidSaleStateException.class);
        assertThat(sale.getStatus()).isEqualTo(SaleStatus.RETURNED);
    }

    @Test
    @DisplayName("una venta anulada no puede marcarse como devuelta")
    void cannotReturnCanceledSale() {
        Sale sale = sale();
        sale.cancel("x");
        assertThatThrownBy(sale::markAsReturned).isInstanceOf(InvalidSaleStateException.class);
    }

    @Test
    @DisplayName("el motivo de la anulación es obligatorio")
    void reasonRequired() {
        assertThatThrownBy(() -> sale().cancel("  ")).isInstanceOf(IllegalArgumentException.class);
    }
}
