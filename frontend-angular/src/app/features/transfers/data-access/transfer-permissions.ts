import type { Role } from '@core/auth/roles/role';
import type { Transfer } from './transfers-api';

/** Quién mira el traslado: su rol y su sucursal (el ADMIN no tiene). */
export interface Actor {
  readonly role: Role | null;
  readonly branchId: number | null;
}

export interface TransferActions {
  /** La sucursal que recibe aprueba la solicitud. */
  readonly approve: boolean;
  /** La sucursal de origen autoriza la salida. */
  readonly prepare: boolean;
  readonly dispatch: boolean;
  readonly receive: boolean;
  readonly cancel: boolean;
  readonly reject: boolean;
  /** Resolver una novedad: merma, reenvío o reclamo. */
  readonly resolve: boolean;
}

/**
 * Qué puede hacer quien mira con este traslado. Es una guía para no ofrecer botones que el servidor rechazaría (el
 * servidor sigue siendo quien decide): el ADMIN actúa sobre cualquier traslado; los demás solo si su sucursal es la
 * que corresponde al paso, y aprobar, autorizar, cancelar, rechazar y resolver son además de gerencia.
 */
export function transferActions(transfer: Transfer, actor: Actor): TransferActions {
  const admin = actor.role === 'ADMIN';
  const manager = admin || actor.role === 'MANAGER';
  const operational = admin || actor.role === 'MANAGER' || actor.role === 'OPERADOR_INVENTARIO';
  const origin = admin || (actor.branchId !== null && actor.branchId === transfer.originBranchId);
  const destination = admin || (actor.branchId !== null && actor.branchId === transfer.destinationBranchId);
  const either = origin || destination;
  const status = transfer.status;
  return {
    approve: status === 'PENDING' && manager && destination,
    prepare: status === 'APPROVED_DEST' && manager && origin,
    dispatch: status === 'PREPARING' && operational && origin,
    receive: status === 'IN_TRANSIT' && operational && destination,
    cancel: ['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT'].includes(status) && manager && either,
    reject: ['PENDING', 'IN_TRANSIT'].includes(status) && manager && either,
    resolve: status === 'WITH_ISSUE' && manager && either,
  };
}
