import { LucideClipboardCheck, LucideTriangleAlert, LucideUndo2 } from '@lucide/angular';
import type { SelectOption } from '@shared/ui/select/select';
import type { MovementReason, MovementType } from './inventory-api';

/** Cómo se nombra cada motivo del kardex en pantalla. */
export const REASON_LABELS: Record<MovementReason, string> = {
  VENTA: 'Venta',
  COMPRA: 'Compra',
  TRASLADO: 'Traslado',
  MERMA: 'Merma',
  DEVOLUCION: 'Devolución',
  AJUSTE_POSITIVO: 'Ajuste (+)',
  AJUSTE_NEGATIVO: 'Ajuste (−)',
};

/** Categorías de una merma. Los códigos son los que ya guarda el sistema en `subReason`. */
export const SHRINKAGE_CATEGORIES: readonly SelectOption<string>[] = [
  { value: 'CADUCIDAD', label: 'Caducidad', description: 'Producto vencido o en mal estado por el tiempo' },
  { value: 'DAÑO_FISICO', label: 'Daño físico', description: 'Bulto roto, accidente' },
  { value: 'ROBO_PERDIDA', label: 'Robo / pérdida' },
  { value: 'DEFECTO_FABRICA', label: 'Defecto de fábrica', description: 'Reclamable al proveedor' },
];

export function subReasonLabel(code: string): string {
  return SHRINKAGE_CATEGORIES.find((category) => category.value === code)?.label ?? code;
}

/**
 * Motivos de un ajuste manual. Compra, venta y traslado no están aquí: tienen su propia pantalla y mueven
 * el stock con sus propios documentos.
 */
export const MANUAL_REASONS: Record<MovementType, readonly SelectOption<MovementReason>[]> = {
  INGRESO: [
    { value: 'AJUSTE_POSITIVO', label: 'Ajuste de auditoría (+)', description: 'Corrección tras un conteo físico', icon: LucideClipboardCheck.icon },
    { value: 'DEVOLUCION', label: 'Devolución de cliente', description: 'Mercancía que regresa al inventario', icon: LucideUndo2.icon },
  ],
  RETIRO: [
    { value: 'MERMA', label: 'Merma / daño', description: 'Pérdida por daño, vencimiento o robo', icon: LucideTriangleAlert.icon },
    { value: 'AJUSTE_NEGATIVO', label: 'Ajuste de auditoría (−)', description: 'Corrección tras un conteo físico', icon: LucideClipboardCheck.icon },
  ],
};

/** Los ajustes y las mermas deben justificarse con detalle (queda en el kardex). */
export const MIN_JUSTIFICATION_LENGTH = 15;

export function requiresJustification(reason: MovementReason | null): boolean {
  return reason === 'AJUSTE_POSITIVO' || reason === 'AJUSTE_NEGATIVO' || reason === 'MERMA';
}

