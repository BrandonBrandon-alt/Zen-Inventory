package co.com.zenvory.inventario.purchase.domain.model;

import co.com.zenvory.inventario.purchase.domain.exception.InvalidPurchaseStateException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("PurchaseOrder — anular un pago (contra-asiento)")
class PurchaseOrderPaymentVoidTest {

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    private static PurchasePayment payment(long id, String amount) {
        return new PurchasePayment(id, bd(amount), LocalDateTime.of(2026, 10, 1, 9, 0), 2L, "Ana", PaymentMethod.TRANSFERENCIA, "TR-" + id, null);
    }

    /** Una orden de 1.000 recibida, tal como sale de la base con sus pagos (ya tienen id). */
    private static PurchaseOrder order(PaymentStatus status, PurchasePayment... payments) {
        return new PurchaseOrder(1L, 2L, 3L, 4L, 4L, LocalDateTime.of(2026, 9, 20, 8, 0), null, LocalDateTime.of(2026, 9, 25, 8, 0), 3,
                ReceptionStatus.RECEIVED_TOTAL, status, 30, LocalDateTime.of(2026, 10, 25, 8, 0), bd("1000"),
                List.of(new PurchaseOrderDetail(11L, 5L, bd("10"), bd("100"), null, bd("10"))),
                null, null, null, false, 0, List.of(payments));
    }

    @Test
    @DisplayName("el pago anulado sigue en el historial pero deja de contar: vuelve el saldo y el estado")
    void voidedPaymentStopsCounting() {
        PurchaseOrder order = order(PaymentStatus.PAGADO, payment(1, "600"), payment(2, "400"));

        PurchasePayment voided = order.voidPayment(2L, "  Se registró dos veces  ", 7L, "Luis");

        assertThat(order.getPayments()).hasSize(2);
        assertThat(voided.isVoided()).isTrue();
        assertThat(voided.getVoidReason()).isEqualTo("Se registró dos veces");
        assertThat(voided.getVoidedByUserName()).isEqualTo("Luis");
        assertThat(voided.getVoidedAt()).isNotNull();
        assertThat(voided.getAmount()).isEqualByComparingTo("400"); // lo que se registró no se edita
        assertThat(voided.getUserName()).isEqualTo("Ana");
        assertThat(order.paidAmount()).isEqualByComparingTo("600");
        assertThat(order.balance()).isEqualByComparingTo("400");
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAGO_PARCIAL);
    }

    @Test
    @DisplayName("anular el único pago deja la orden por pagar, y se puede volver a pagar")
    void voidingOnlyPayment_backToUnpaid() {
        PurchaseOrder order = order(PaymentStatus.PAGADO, payment(1, "1000"));

        order.voidPayment(1L, "Monto equivocado", 7L, "Luis");

        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.POR_PAGAR);
        assertThat(order.balance()).isEqualByComparingTo("1000");
        order.registerPayment(bd("1000"), PaymentMethod.EFECTIVO, null, null, 7L, "Luis");
        assertThat(order.getPaymentStatus()).isEqualTo(PaymentStatus.PAGADO);
    }

    @Test
    @DisplayName("un pago ya anulado no se anula otra vez, y sin motivo no se anula")
    void rejectsDoubleVoidAndMissingReason() {
        PurchaseOrder order = order(PaymentStatus.PAGADO, payment(1, "1000"));

        assertThatThrownBy(() -> order.voidPayment(1L, "  ", 7L, "Luis")).isInstanceOf(IllegalArgumentException.class);
        assertThat(order.paidAmount()).isEqualByComparingTo("1000");

        order.voidPayment(1L, "Duplicado", 7L, "Luis");
        assertThatThrownBy(() -> order.voidPayment(1L, "Otra vez", 7L, "Luis")).isInstanceOf(InvalidPurchaseStateException.class);
    }

    @Test
    @DisplayName("un pago que no es de esta orden no se encuentra")
    void unknownPayment() {
        PurchaseOrder order = order(PaymentStatus.PAGADO, payment(1, "1000"));
        assertThatThrownBy(() -> order.voidPayment(99L, "x", 7L, "Luis")).isInstanceOf(IllegalArgumentException.class);
    }
}
