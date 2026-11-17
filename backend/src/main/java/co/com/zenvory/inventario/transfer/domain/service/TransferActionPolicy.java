package co.com.zenvory.inventario.transfer.domain.service;

import co.com.zenvory.inventario.shared.domain.Viewer;
import co.com.zenvory.inventario.transfer.domain.model.TransferStatus;

/**
 * Cuándo un traslado espera una acción de quien lo mira («te toca»): aprobar en destino (gerencia del destino),
 * autorizar la salida (gerencia del origen), despachar (operación del origen), recibir (operación del destino) o
 * resolver una novedad (gerencia de cualquiera de las dos). El ADMIN cuenta como de ambas sucursales. La búsqueda en
 * SQL lleva la misma regla y una prueba exige que coincidan.
 */
public final class TransferActionPolicy {

    private TransferActionPolicy() {
    }

    public static boolean awaits(TransferStatus status, Long originId, Long destinationId, Viewer viewer) {
        boolean origin = viewer.admin() || (viewer.branchId() != null && viewer.branchId().equals(originId));
        boolean destination = viewer.admin() || (viewer.branchId() != null && viewer.branchId().equals(destinationId));
        return switch (status) {
            case PENDING -> viewer.manager() && destination;
            case APPROVED_DEST -> viewer.manager() && origin;
            case PREPARING -> viewer.operational() && origin;
            case IN_TRANSIT -> viewer.operational() && destination;
            case WITH_ISSUE -> viewer.manager() && (origin || destination);
            default -> false;
        };
    }
}
