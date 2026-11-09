package co.com.zenvory.inventario.purchase.domain.model;

import co.com.zenvory.inventario.purchase.domain.exception.InvalidPurchaseStateException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("PurchaseOrder — registro de pagos")
class PurchaseOrderPaymentTest {

    private PurchaseOrder order;

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    @BeforeEach
    void setUp() {
        // 10 uds a 100 con 20 % = 800; 5 uds a 50 = 250. Total 1050.
        order = PurchaseOrder.create(1L, 2L, 3L, null, 30, List.of(
                new PurchaseOrderDetail(11L, 5L, bd("10"), bd("100"), bd("20"), null),
                new PurchaseOrderDetail(12L, 6L, bd("5"), bd("50"), null, null)), true);
    }

    private void receive() { order.receive(9L, true); }

    @Test
    @DisplayName("no se paga una orden que aún no se recibió")
    void cannotPayBeforeReceiving() {
        assertThatThrownBy(() -> order.registerPayment(bd("100"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana"))
                .isInstanceOf(InvalidPurchaseStateException.class);
        assertThat(order.getPayments()).isEmpty();
    }

    @Test
    @DisplayName("un abono deja la orden en PAGO_PARCIAL con el saldo que falta")
    void partialPayment() {
        receive();
        PurchasePayment p = order.registerPayment(bd("400"), PaymentMethod.TRANSFERENCIA, " TR-1 ", null, 2L, "Ana");

        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAGO_PARCIAL);
        assertThat(order.paidAmount()).isEqualByComparingTo("400");
        assertThat(order.balance()).isEqualByComparingTo("650");
        assertThat(p.getReference()).isEqualTo("TR-1");
        assertThat(p.getUserName()).isEqualTo("Ana");
    }

    @Test
    @DisplayName("los abonos suman y al cubrir el total la orden queda PAGADO")
    void paymentsAddUpToPaid() {
        receive();
        order.registerPayment(bd("400"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana");
        order.registerPayment(bd("650"), PaymentMethod.CHEQUE, "CH-9", "saldo", 2L, "Ana");

        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAGADO);
        assertThat(order.getPayments()).hasSize(2);
        assertThat(order.balance()).isEqualByComparingTo("0");
    }

    @Test
    @DisplayName("sin monto se paga todo el saldo pendiente")
    void nullAmountPaysBalance() {
        receive();
        order.registerPayment(bd("50"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana");
        PurchasePayment rest = order.registerPayment(null, null, null, null, 2L, "Ana");

        assertThat(rest.getAmount()).isEqualByComparingTo("1000");
        assertThat(rest.getMethod()).isEqualTo(PaymentMethod.OTRO);
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAGADO);
    }

    @Test
    @DisplayName("no se admite pagar más que el saldo, ni montos en cero o negativos")
    void rejectsInvalidAmounts() {
        receive();
        assertThatThrownBy(() -> order.registerPayment(bd("1050.01"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana"))
                .isInstanceOf(InvalidPurchaseStateException.class).hasMessageContaining("excede el saldo");
        assertThatThrownBy(() -> order.registerPayment(bd("0"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> order.registerPayment(bd("-5"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(order.getPayments()).isEmpty();
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.POR_PAGAR);
    }

    @Test
    @DisplayName("una orden ya pagada no se vuelve a pagar")
    void cannotPayTwice() {
        receive();
        order.registerPayment(null, PaymentMethod.EFECTIVO, null, null, 2L, "Ana");
        assertThatThrownBy(() -> order.registerPayment(bd("1"), PaymentMethod.EFECTIVO, null, null, 2L, "Ana"))
                .isInstanceOf(InvalidPurchaseStateException.class).hasMessageContaining("ya se encuentra pagada");
    }

    @Test
    @DisplayName("está vencida si queda saldo y pasó la fecha; pagada o cancelada no lo está")
    void overdue() {
        LocalDateTime afterDue = order.getPaymentDueDate().plusDays(1);
        assertThat(order.isOverdue(order.getPaymentDueDate().minusDays(1))).isFalse();
        assertThat(order.isOverdue(afterDue)).isTrue();

        receive();
        order.registerPayment(null, PaymentMethod.EFECTIVO, null, null, 2L, "Ana");
        assertThat(order.isOverdue(afterDue)).isFalse();

        PurchaseOrder cancelled = PurchaseOrder.create(1L, 2L, 3L, null, 30, List.of(
                new PurchaseOrderDetail(13L, 5L, bd("1"), bd("10"), null, null)), true);
        cancelled.cancel("ya no hace falta", 2L);
        assertThat(cancelled.balance()).isEqualByComparingTo("0");
        assertThat(cancelled.isOverdue(afterDue)).isFalse();
    }
}
