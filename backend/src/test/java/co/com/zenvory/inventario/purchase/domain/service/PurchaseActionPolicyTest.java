package co.com.zenvory.inventario.purchase.domain.service;

import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.shared.domain.Viewer;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("PurchaseActionPolicy — a quién le toca una orden de compra")
class PurchaseActionPolicyTest {

    static final Viewer ADMIN = new Viewer(true, true, true, null);
    static final Viewer MANAGER = new Viewer(false, true, true, 1L);
    static final Viewer OPERADOR = new Viewer(false, false, true, 1L);
    static final Viewer SELLER = new Viewer(false, false, false, 1L);

    @ParameterizedTest(name = "{0}: admin={1} gerente={2} operador={3} vendedor={4}")
    @CsvSource({
            "AWAITING_APPROVAL, true,  true,  false, false",
            "PENDING,           false, false, false, false",
            "IN_TRANSIT,        true,  true,  true,  false",
            "RECEIVED_PARTIAL,  false, false, false, false",
            "RECEIVED_TOTAL,    false, false, false, false",
            "CANCELLED,         false, false, false, false",
    })
    void tablaEstadoPorRol(ReceptionStatus status, boolean admin, boolean manager, boolean operador, boolean seller) {
        assertThat(PurchaseActionPolicy.awaits(status, ADMIN)).isEqualTo(admin);
        assertThat(PurchaseActionPolicy.awaits(status, MANAGER)).isEqualTo(manager);
        assertThat(PurchaseActionPolicy.awaits(status, OPERADOR)).isEqualTo(operador);
        assertThat(PurchaseActionPolicy.awaits(status, SELLER)).isEqualTo(seller);
    }
}
