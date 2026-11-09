import type { Role } from '@core/auth/roles/role';
import type { Purchase } from './purchases-api';

export interface PurchaseActions {
  readonly approve: boolean;
  /** Marcar como enviada por el proveedor. */
  readonly dispatch: boolean;
  readonly receive: boolean;
  readonly pay: boolean;
  readonly cancel: boolean;
  /** Dar por completa una orden recibida a medias, aceptando el faltante. */
  readonly closeShortfall: boolean;
}

/**
 * Qué puede hacer cada rol con una orden de compra según su estado. Es una guía para no ofrecer botones que el servidor
 * rechazaría (el servidor sigue decidiendo): aprobar, enviar, pagar y cancelar son de gerencia; recibir también lo hace
 * el operador de inventario; cerrar con faltante es solo del administrador.
 */
export function purchaseActions(purchase: Purchase, role: Role | null): PurchaseActions {
  const admin = role === 'ADMIN';
  const manager = admin || role === 'MANAGER';
  const operational = manager || role === 'OPERADOR_INVENTARIO';
  const status = purchase.reception;
  const received = status === 'RECEIVED_TOTAL' || status === 'RECEIVED_PARTIAL';
  return {
    approve: status === 'AWAITING_APPROVAL' && manager,
    dispatch: status === 'PENDING' && manager,
    receive: (status === 'PENDING' || status === 'IN_TRANSIT' || status === 'RECEIVED_PARTIAL') && operational,
    pay: received && purchase.payment !== 'PAGADO' && purchase.balance > 0 && manager,
    cancel: (status === 'AWAITING_APPROVAL' || status === 'PENDING' || status === 'IN_TRANSIT') && manager,
    closeShortfall: status === 'RECEIVED_PARTIAL' && admin,
  };
}
