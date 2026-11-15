package co.com.zenvory.inventario.purchase.domain.service;

import co.com.zenvory.inventario.purchase.domain.model.ReceptionStatus;
import co.com.zenvory.inventario.shared.domain.Viewer;

/**
 * Cuándo una orden de compra espera una acción de quien la mira («te toca»): aprobar una orden por aprobar (gerencia)
 * o recibir la que ya viene en camino (quien opera inventario). La búsqueda en SQL lleva la misma regla y una prueba
 * exige que coincidan.
 */
public final class PurchaseActionPolicy {

    private PurchaseActionPolicy() {
    }

    public static boolean awaits(ReceptionStatus status, Viewer viewer) {
        return (status == ReceptionStatus.AWAITING_APPROVAL && viewer.manager())
                || (status == ReceptionStatus.IN_TRANSIT && viewer.operational());
    }
}
