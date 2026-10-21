package co.com.zenvory.inventario.transfer.domain.model;

import co.com.zenvory.inventario.transfer.domain.exception.InvalidTransferStateException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Transfer — pago del flete")
class TransferFreightPaymentTest {

    private Transfer transfer;

    private static BigDecimal bd(String v) { return new BigDecimal(v); }

    @BeforeEach
    void setUp() {
        transfer = Transfer.create(1L, 2L, LocalDateTime.now().plusDays(2),
                List.of(new TransferDetail(null, 5L, "P", 10, 0, 0, 0)), TransferPriority.NORMAL, 9L, "Ana");
    }

    private void dispatchWithCost(String cost) {
        transfer.approveDestination(9L, "Ana");
        transfer.prepare(9L, "Ana");
        transfer.dispatch("Servientrega", cost == null ? null : bd(cost), "G-1", LocalDateTime.now().plusDays(1), 9L, "Ana");
    }

    @Test
    @DisplayName("antes de despachar no hay flete: el estado es SIN_COSTO y no se puede pagar")
    void noFreightBeforeDispatch() {
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.SIN_COSTO);
        assertThatThrownBy(() -> transfer.registerFreightPayment(bd("10"), TransferPaymentMethod.EFECTIVO, null, null, 9L, "Ana"))
                .isInstanceOf(InvalidTransferStateException.class);
    }

    @Test
    @DisplayName("un envío con costo queda POR_PAGAR; sin costo (o en cero) no tiene flete")
    void statusAfterDispatch() {
        dispatchWithCost("200000");
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.POR_PAGAR);
        assertThat(transfer.freightBalance()).isEqualByComparingTo("200000");
    }

    @Test
    @DisplayName("un costo de envío en cero no genera deuda")
    void zeroCostHasNoFreight() {
        dispatchWithCost("0");
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.SIN_COSTO);
        assertThatThrownBy(() -> transfer.registerFreightPayment(null, null, null, null, 9L, "Ana"))
                .isInstanceOf(InvalidTransferStateException.class);
    }

    @Test
    @DisplayName("un abono deja PAGO_PARCIAL con el saldo; los abonos suman y al cubrir el total queda PAGADO")
    void partialThenFull() {
        dispatchWithCost("200000");
        TransferPayment first = transfer.registerFreightPayment(bd("50000"), TransferPaymentMethod.TRANSFERENCIA, " TR-1 ", null, 9L, "Ana");
        assertThat(first.getReference()).isEqualTo("TR-1");
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.PAGO_PARCIAL);
        assertThat(transfer.freightBalance()).isEqualByComparingTo("150000");
        transfer.registerFreightPayment(bd("150000"), TransferPaymentMethod.CHEQUE, "CH-2", "saldo", 9L, "Ana");
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.PAGADO);
        assertThat(transfer.freightPaid()).isEqualByComparingTo("200000");
        assertThat(transfer.getPayments()).hasSize(2);
    }

    @Test
    @DisplayName("sin monto se paga todo el saldo pendiente")
    void nullAmountPaysBalance() {
        dispatchWithCost("200000");
        transfer.registerFreightPayment(bd("30000"), TransferPaymentMethod.EFECTIVO, null, null, 9L, "Ana");
        TransferPayment rest = transfer.registerFreightPayment(null, null, null, null, 9L, "Ana");
        assertThat(rest.getAmount()).isEqualByComparingTo("170000");
        assertThat(rest.getMethod()).isEqualTo(TransferPaymentMethod.OTRO);
    }

    @Test
    @DisplayName("no se admite pagar más que el saldo, ni montos en cero o negativos, ni pagar dos veces")
    void rejectsInvalidPayments() {
        dispatchWithCost("200000");
        assertThatThrownBy(() -> transfer.registerFreightPayment(bd("200000.01"), TransferPaymentMethod.EFECTIVO, null, null, 9L, "Ana"))
                .isInstanceOf(InvalidTransferStateException.class).hasMessageContaining("excede el saldo");
        assertThatThrownBy(() -> transfer.registerFreightPayment(bd("0"), TransferPaymentMethod.EFECTIVO, null, null, 9L, "Ana"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(transfer.getPayments()).isEmpty();
        transfer.registerFreightPayment(null, TransferPaymentMethod.EFECTIVO, null, null, 9L, "Ana");
        assertThatThrownBy(() -> transfer.registerFreightPayment(bd("1"), TransferPaymentMethod.EFECTIVO, null, null, 9L, "Ana"))
                .isInstanceOf(InvalidTransferStateException.class).hasMessageContaining("ya está pagado");
    }

    @Test
    @DisplayName("un traslado cancelado en tránsito conserva su deuda: el transportista ya hizo el viaje")
    void cancelledInTransitKeepsDebt() {
        dispatchWithCost("200000");
        transfer.cancel("se devolvió la carga", 9L, "Ana");
        assertThat(transfer.freightBalance()).isEqualByComparingTo("200000");
        transfer.registerFreightPayment(bd("200000"), TransferPaymentMethod.TRANSFERENCIA, null, null, 9L, "Ana");
        assertThat(transfer.freightPaymentStatus()).isEqualTo(FreightPaymentStatus.PAGADO);
    }
}
