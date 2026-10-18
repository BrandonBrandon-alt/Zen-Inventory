import { LucideCircleCheck, LucideClock, LucideXCircle, type LucideIconData } from '@lucide/angular';
import type { BadgeVariant } from '@shared/ui/badge/badge';
import type { ReturnStatus } from './returns-api';

export const RETURN_INFO: Readonly<Record<ReturnStatus, { label: string; variant: BadgeVariant; icon: LucideIconData; next: string }>> = {
  PENDIENTE: { label: 'Pendiente', variant: 'warning', icon: LucideClock.icon, next: 'Un gerente debe aprobarla o rechazarla.' },
  APROBADA: { label: 'Aprobada', variant: 'success', icon: LucideCircleCheck.icon, next: 'Aprobada: las unidades volvieron al stock de la sucursal.' },
  RECHAZADA: { label: 'Rechazada', variant: 'neutral', icon: LucideXCircle.icon, next: 'Rechazada: no se movió stock.' },
};
