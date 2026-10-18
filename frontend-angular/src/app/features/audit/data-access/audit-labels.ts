import {
  LucideClipboardCheck,
  LucideRepeat,
  LucideShoppingBag,
  LucideShoppingCart,
  LucideTriangleAlert,
  LucideTruck,
  type LucideIconData,
} from '@lucide/angular';
import type { BadgeVariant } from '@shared/ui/badge/badge';
import type { MovementReason } from './audit-api';

export const REASON_INFO: Readonly<Record<MovementReason, { label: string; icon: LucideIconData; variant: BadgeVariant }>> = {
  VENTA: { label: 'Venta', icon: LucideShoppingCart.icon, variant: 'info' },
  COMPRA: { label: 'Compra', icon: LucideShoppingBag.icon, variant: 'success' },
  TRASLADO: { label: 'Traslado', icon: LucideTruck.icon, variant: 'info' },
  MERMA: { label: 'Merma', icon: LucideTriangleAlert.icon, variant: 'danger' },
  DEVOLUCION: { label: 'Devolución', icon: LucideRepeat.icon, variant: 'warning' },
  AJUSTE_POSITIVO: { label: 'Ajuste (+)', icon: LucideClipboardCheck.icon, variant: 'neutral' },
  AJUSTE_NEGATIVO: { label: 'Ajuste (−)', icon: LucideClipboardCheck.icon, variant: 'neutral' },
};

const SUB_REASONS: Readonly<Record<string, string>> = {
  CADUCIDAD: 'Caducidad',
  DAÑO_FISICO: 'Daño físico',
  ROBO_PERDIDA: 'Robo / pérdida',
  DEFECTO_FABRICA: 'Defecto de fábrica',
};

export const subReasonText = (code: string): string => SUB_REASONS[code] ?? code.replace(/_/g, ' ').toLowerCase();

const DOCUMENTS: Readonly<Record<string, string>> = { VENTA: 'Venta', COMPRA: 'Compra', TRASLADO: 'Traslado', DEVOLUCION: 'Devolución' };

/** `Venta #12`: el documento que originó el movimiento; vacío si fue un ajuste manual (sin documento). */
export function documentLabel(type: string, id: number | null): string {
  if (!type && id === null) return '';
  const name = DOCUMENTS[type] ?? (type ? type.replace(/_/g, ' ').toLowerCase().replace(/^./, (c) => c.toUpperCase()) : 'Documento');
  return id === null ? name : `${name} #${id}`;
}
