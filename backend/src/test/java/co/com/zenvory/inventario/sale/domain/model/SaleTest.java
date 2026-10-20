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
        return Sale.create(1L, "Sede", 2L, "Ana", "Cliente", "123", SalePaymentMethod.EFECTIVO, null, BigDecimal.ZERO,
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

    @Test
    @DisplayName("una venta nueva exige la forma de pago y guarda la referencia sin espacios sobrantes")
    void paymentMethodIsRequired() {
        List<SaleDetail> items = List.of(SaleDetail.create(5L, "P", 1, new BigDecimal("10"), BigDecimal.ZERO));
        assertThatThrownBy(() -> Sale.create(1L, "Sede", 2L, "Ana", "C", "1", null, null, BigDecimal.ZERO, items))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("forma de pago");

        Sale sale = Sale.create(1L, "Sede", 2L, "Ana", "C", "1", SalePaymentMethod.TRANSFERENCIA, "  TR-9 ", BigDecimal.ZERO, items);
        assertThat(sale.getPaymentMethod()).isEqualTo(SalePaymentMethod.TRANSFERENCIA);
        assertThat(sale.getPaymentReference()).isEqualTo("TR-9");
        assertThat(Sale.create(1L, "Sede", 2L, "Ana", "C", "1", SalePaymentMethod.EFECTIVO, "   ", BigDecimal.ZERO, items).getPaymentReference()).isNull();
    }

    @Test
    @DisplayName("una venta anterior al registro de la forma de pago se puede leer, anular y devolver con la forma de pago vacía")
    void legacySaleHasNoPaymentMethod() {
        Sale legacy = new Sale(1L, null, 1L, "Sede", 2L, "Ana", SaleStatus.COMPLETED, null, "C", "1", BigDecimal.ZERO,
                List.of(SaleDetail.create(5L, "P", 1, new BigDecimal("10"), BigDecimal.ZERO)));
        assertThat(legacy.getPaymentMethod()).isNull();
        legacy.cancel("x");
        assertThat(legacy.getStatus()).isEqualTo(SaleStatus.CANCELED);
    }
}
