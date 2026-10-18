import type { components } from '@core/api/schema';

export type StockAlertResponse = components['schemas']['StockAlertResponse'];

export const ALERT_TYPES = ['LOW_STOCK', 'TRANSFER_REQUEST', 'RETURN_REQUEST', 'PURCHASE_REQUEST', 'ISSUE_REPORTED', 'VOID_SALE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const isAlertType = (value: unknown): value is AlertType => (ALERT_TYPES as readonly unknown[]).includes(value);

/**
 * Una alerta que la app sabe mostrar. La pantalla de Alertas y la insignia del menú cuentan con esta misma regla,
 * para que el número del menú coincida con las filas de la tabla.
 */
export function isShowableAlert(raw: StockAlertResponse): raw is StockAlertResponse & { id: number; branchId: number; productId: number; type: AlertType; message: string } {
  return typeof raw.id === 'number' && typeof raw.branchId === 'number' && typeof raw.productId === 'number' && !!raw.message?.trim() && isAlertType(raw.type);
}
