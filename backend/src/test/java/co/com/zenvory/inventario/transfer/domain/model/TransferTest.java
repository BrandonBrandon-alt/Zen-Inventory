package co.com.zenvory.inventario.transfer.domain.model;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Transfer / TransferDetail — límites de cantidades")
class TransferTest {

    private TransferDetail detail() {
        return new TransferDetail(1L, 5L, "P", 10, 0, 0, 0);
    }

    @Test
    @DisplayName("no se puede enviar más de lo solicitado")
    void cannotSendMoreThanRequested() {
        assertThatThrownBy(() -> detail().registerDispatch(11)).isInstanceOf(IllegalArgumentException.class);
        TransferDetail ok = detail();
        ok.registerDispatch(10);
        assertThat(ok.getSentQuantity()).isEqualTo(10);
    }

    @Test
    @DisplayName("no se puede recibir más de lo enviado: crearía stock de la nada")
    void cannotReceiveMoreThanSent() {
        TransferDetail d = detail();
        d.registerDispatch(5);
        assertThatThrownBy(() -> d.registerReceipt(500)).isInstanceOf(IllegalArgumentException.class);
        d.registerReceipt(5);
        assertThat(d.getMissingQuantity()).isZero();
    }

    @Test
    @DisplayName("recibir menos de lo enviado registra el faltante")
    void shortReceiptRecordsMissing() {
        TransferDetail d = detail();
        d.registerDispatch(8);
        d.registerReceipt(6);
        assertThat(d.getMissingQuantity()).isEqualTo(2);
    }

    @Test
    @DisplayName("el origen y el destino deben ser distintos")
    void originAndDestinationMustDiffer() {
        assertThatThrownBy(() -> Transfer.create(1L, 1L, null, List.of(detail()), TransferPriority.NORMAL, 9L, "Ana"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThat(Transfer.create(1L, 2L, null, List.of(detail()), TransferPriority.NORMAL, 9L, "Ana").getDestinationBranchId()).isEqualTo(2L);
    }
}
