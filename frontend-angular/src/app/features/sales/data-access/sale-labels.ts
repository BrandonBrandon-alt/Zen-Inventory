import { LucideBan, LucideCircleCheck, LucideUndo2, type LucideIconData } from '@lucide/angular';
import type { BadgeVariant } from '@shared/ui/badge/badge';
import type { SaleStatus } from './sales-api';

export const SALE_INFO: Readonly<Record<SaleStatus, { label: string; variant: BadgeVariant; icon: LucideIconData }>> = {
  COMPLETED: { label: 'Completada', variant: 'success', icon: LucideCircleCheck.icon },
  CANCELED: { label: 'Anulada', variant: 'neutral', icon: LucideBan.icon },
  RETURNED: { label: 'Con devolución', variant: 'warning', icon: LucideUndo2.icon },
};

/** Texto del cliente: sin nombre, la venta es a un cliente sin registrar. */
export const customerLabel = (name: string): string => name || 'Cliente sin registrar';
