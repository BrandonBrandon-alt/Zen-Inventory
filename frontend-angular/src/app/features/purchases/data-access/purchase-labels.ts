import {
  LucideBan,
  LucideClock,
  LucidePackageCheck,
  LucidePackageOpen,
  LucideTruck,
  LucideWallet,
  type LucideIconData,
} from '@lucide/angular';
import type { BadgeVariant } from '@shared/ui/badge/badge';
import type { PaymentStatus, ReceptionStatus } from './purchases-api';

export interface StatusInfo {
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly icon: LucideIconData;
  /** Qué sigue, dicho para quien debe actuar. */
  readonly next: string;
}

export const RECEPTION_INFO: Readonly<Record<ReceptionStatus, StatusInfo>> = {
  AWAITING_APPROVAL: { label: 'Por aprobar', variant: 'warning', icon: LucideClock.icon, next: 'Un gerente debe aprobar la orden para que se pueda comprar.' },
  PENDING: { label: 'Aprobada', variant: 'info', icon: LucidePackageOpen.icon, next: 'Aprobada: falta marcarla como enviada por el proveedor o recibirla.' },
  IN_TRANSIT: { label: 'En camino', variant: 'info', icon: LucideTruck.icon, next: 'El proveedor ya la envió: falta registrar lo que llegue.' },
  RECEIVED_PARTIAL: { label: 'Recibida parcial', variant: 'warning', icon: LucidePackageOpen.icon, next: 'Llegó parte de la mercancía: se puede seguir recibiendo o cerrar con faltante.' },
  RECEIVED_TOTAL: { label: 'Recibida', variant: 'success', icon: LucidePackageCheck.icon, next: 'Mercancía recibida completa.' },
  CANCELLED: { label: 'Cancelada', variant: 'neutral', icon: LucideBan.icon, next: 'Orden cancelada.' },
};

export const PAYMENT_INFO: Readonly<Record<PaymentStatus, { label: string; variant: BadgeVariant; icon: LucideIconData }>> = {
  POR_PAGAR: { label: 'Por pagar', variant: 'warning', icon: LucideWallet.icon },
  PAGO_PARCIAL: { label: 'Pago parcial', variant: 'warning', icon: LucideWallet.icon },
  PAGADO: { label: 'Pagada', variant: 'success', icon: LucideWallet.icon },
};

export { PAYMENT_METHOD_LABELS } from '@core/payments/payment-method';

/** Órdenes que todavía se están moviendo (no recibidas del todo ni canceladas). */
export const OPEN_RECEPTIONS: readonly ReceptionStatus[] = ['AWAITING_APPROVAL', 'PENDING', 'IN_TRANSIT', 'RECEIVED_PARTIAL'];
