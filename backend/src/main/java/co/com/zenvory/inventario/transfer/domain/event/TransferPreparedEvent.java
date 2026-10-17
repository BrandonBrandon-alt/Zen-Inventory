package co.com.zenvory.inventario.transfer.domain.event;

import java.util.Set;

/**
 * Se publica cuando el origen autoriza la salida de un traslado. El módulo de alertas la usa para cerrar las alertas
 * de "solicitud de traslado" de esos productos, sin que un fallo ahí pueda deshacer la preparación.
 */
public record TransferPreparedEvent(Long transferId, Long originBranchId, Set<Long> productIds) {}
