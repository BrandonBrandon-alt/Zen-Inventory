package co.com.zenvory.inventario.transfer.domain.model;

import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Transfer — anular un pago del flete (contra-asiento)")
class TransferFreightPaymentVoidTest {

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    private static TransferPayment payment(long id, String amount) {
        return new TransferPayment(id, bd(amount), LocalDateTime.of(2026, 10, 2, 9, 0), 9L, "Ana", TransferPaymentMethod.EFECTIVO, null, null);
    }

    /** Un traslado despachado con 100 de flete, tal como sale de la base con sus pagos (ya tienen id). */
    private static Transfer dispatched(TransferPayment... payments) {
        LocalDateTime dispatch = LocalDateTime.of(2026, 10, 1, 8, 0);
        return new Transfer(1L, TransferStatus.IN_TRANSIT, dispatch.minusDays(1), dispatch.plusDays(1), null, 1L, 2L, "Servientrega", null,
                List.of(new TransferDetail(5L, 5L, "P", 10, 10, 0, 0)), null, TransferPriority.NORMAL, bd("100"), "G-1", null, null,
                dispatch, 0, 9L, "Ana", 9L, "Ana", 9L, "Ana", null, null, null, null, List.of(payments));
    }

    @Test
    @DisplayName("el pago anulado queda en el historial pero deja de contar: vuelve el saldo y el estado")
    void voidedPaymentStopsCounting() {
        Transfer transfer = dispatched(payment(1, "60"), payment(2, "40"));
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.PAGADO);

        TransferPayment voided = transfer.voidFreightPayment(2L, "Pago a otro transportista", 7L, "Luis");

        assertThat(transfer.getPayments()).hasSize(2);
        assertThat(voided.isVoided()).isTrue();
        assertThat(transfer.freightPaid()).isEqualByComparingTo("60");
        assertThat(transfer.freightBalance()).isEqualByComparingTo("40");
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.PAGO_PARCIAL);
    }

    @Test
    @DisplayName("con todos los pagos anulados el flete vuelve a estar por pagar (no «pago parcial»)")
    void allVoided_backToUnpaid() {
        Transfer transfer = dispatched(payment(1, "100"));

        transfer.voidFreightPayment(1L, "Duplicado", 7L, "Luis");

        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.POR_PAGAR);
        assertThat(transfer.freightBalance()).isEqualByComparingTo("100");
    }

    @Test
    @DisplayName("no se anula dos veces ni sin motivo, ni un pago que no es de este traslado")
    void rejectsInvalidVoids() {
        Transfer transfer = dispatched(payment(1, "100"));

        assertThatThrownBy(() -> transfer.voidFreightPayment(1L, "", 7L, "Luis")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> transfer.voidFreightPayment(99L, "x", 7L, "Luis")).isInstanceOf(IllegalArgumentException.class);
        transfer.voidFreightPayment(1L, "Duplicado", 7L, "Luis");
        assertThatThrownBy(() -> transfer.voidFreightPayment(1L, "Otra vez", 7L, "Luis")).isInstanceOf(InvalidTransferStateException.class);
    }
}
