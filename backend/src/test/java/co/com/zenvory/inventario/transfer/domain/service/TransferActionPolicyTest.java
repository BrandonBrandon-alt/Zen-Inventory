package co.com.zenvory.inventario.transfer.domain.service;

import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("TransferActionPolicy — a quién le toca un traslado (origen 1 → destino 2)")
class TransferActionPolicyTest {

    private static boolean awaits(TransferStatus status, Viewer viewer) {
        return TransferActionPolicy.awaits(status, 1L, 2L, viewer);
    }

    @ParameterizedTest(name = "{0}")
    @CsvSource({
            // estado,     admin, ger.origen, ger.destino, op.origen, op.destino, ger.ajena, vendedor.destino
            "PENDING,       true,  false,      true,        false,     false,      false,     false",
            "APPROVED_DEST, true,  true,       false,       false,     false,      false,     false",
            "PREPARING,     true,  true,       false,       true,      false,      false,     false",
            "IN_TRANSIT,    true,  false,      true,        false,     true,       false,     false",
            "WITH_ISSUE,    true,  true,       true,        false,     false,      false,     false",
            "UNDER_CLAIM,   false, false,      false,       false,     false,      false,     false",
            "DELIVERED,     false, false,      false,       false,     false,      false,     false",
            "CANCELLED,     false, false,      false,       false,     false,      false,     false",
            "REJECTED,      false, false,      false,       false,     false,      false,     false",
    })
    void tablaEstadoPorRolYSucursal(TransferStatus status, boolean admin, boolean managerOrigin, boolean managerDestination,
                                    boolean opOrigin, boolean opDestination, boolean managerOther, boolean sellerDestination) {
        assertThat(awaits(status, new Viewer(true, true, true, null))).isEqualTo(admin);
        assertThat(awaits(status, new Viewer(false, true, true, 1L))).isEqualTo(managerOrigin);
        assertThat(awaits(status, new Viewer(false, true, true, 2L))).isEqualTo(managerDestination);
        assertThat(awaits(status, new Viewer(false, false, true, 1L))).isEqualTo(opOrigin);
        assertThat(awaits(status, new Viewer(false, false, true, 2L))).isEqualTo(opDestination);
        assertThat(awaits(status, new Viewer(false, true, true, 3L))).isEqualTo(managerOther);
        assertThat(awaits(status, new Viewer(false, false, false, 2L))).isEqualTo(sellerDestination);
    }
}
