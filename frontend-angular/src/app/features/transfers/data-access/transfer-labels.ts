import {
  LucideBan,
  LucideClock,
  LucideFlag,
  LucidePackageCheck,
  LucidePackageOpen,
  LucideThumbsUp,
  LucideTriangleAlert,
  LucideTruck,
  LucideXCircle,
  type LucideIconData,
} from '@lucide/angular';
import type { BadgeVariant } from '@shared/ui/badge/badge';
import type { FreightStatus, TransferPriority, TransferStatus } from './transfers-api';

export interface StatusInfo {
  readonly label: string;
  readonly variant: BadgeVariant;
  readonly icon: LucideIconData;
  /** Qué sigue, dicho para quien debe actuar. */
  readonly next: string;
}

export const STATUS_INFO: Readonly<Record<TransferStatus, StatusInfo>> = {
  PENDING: { label: 'Pendiente', variant: 'warning', icon: LucideClock.icon, next: 'La sucursal que recibe debe aprobarlo.' },
  APPROVED_DEST: { label: 'Aprobado', variant: 'info', icon: LucideThumbsUp.icon, next: 'La sucursal de origen debe autorizar la salida.' },
  PREPARING: { label: 'En preparación', variant: 'info', icon: LucidePackageOpen.icon, next: 'La sucursal de origen debe despacharlo.' },
  IN_TRANSIT: { label: 'En tránsito', variant: 'info', icon: LucideTruck.icon, next: 'La sucursal que recibe debe confirmar la llegada.' },
  DELIVERED: { label: 'Entregado', variant: 'success', icon: LucidePackageCheck.icon, next: 'Traslado completado.' },
  WITH_ISSUE: { label: 'Con novedad', variant: 'danger', icon: LucideTriangleAlert.icon, next: 'Llegó distinto a lo enviado: hay que resolver la diferencia.' },
  UNDER_CLAIM: { label: 'En reclamo', variant: 'warning', icon: LucideFlag.icon, next: 'Se abrió un reclamo por la diferencia.' },
  CANCELLED: { label: 'Cancelado', variant: 'neutral', icon: LucideBan.icon, next: 'Traslado cancelado.' },
  REJECTED: { label: 'Rechazado', variant: 'neutral', icon: LucideXCircle.icon, next: 'Traslado rechazado.' },
};

export const PRIORITY_INFO: Readonly<Record<TransferPriority, { label: string; variant: BadgeVariant }>> = {
  HIGH: { label: 'Alta', variant: 'danger' },
  NORMAL: { label: 'Normal', variant: 'neutral' },
  LOW: { label: 'Baja', variant: 'neutral' },
};

export const FREIGHT_INFO: Readonly<Record<FreightStatus, { label: string; variant: BadgeVariant }>> = {
  SIN_COSTO: { label: 'Sin flete', variant: 'neutral' },
  POR_PAGAR: { label: 'Flete por pagar', variant: 'warning' },
  PAGO_PARCIAL: { label: 'Flete con abono', variant: 'warning' },
  PAGADO: { label: 'Flete pagado', variant: 'success' },
};

/** Estados en los que el traslado todavía se está moviendo. */
export const OPEN_STATUSES: readonly TransferStatus[] = ['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT', 'WITH_ISSUE', 'UNDER_CLAIM'];
