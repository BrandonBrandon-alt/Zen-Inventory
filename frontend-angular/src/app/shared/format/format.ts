const MONEY = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 2 });
const QUANTITY = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 4 });
const DATE_TIME = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' });

/** Pesos colombianos: `$ 1.250,5`. `null` o no numérico se muestra como guion. */
export function formatMoney(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? MONEY.format(value) : '—';
}

/** Cantidades con separador de miles y hasta 4 decimales (las unidades pueden ser fraccionarias). */
export function formatQuantity(value: number | null | undefined): string {
  return typeof value === 'number' && Number.isFinite(value) ? QUANTITY.format(value) : '—';
}

export function formatDateTime(value: Date | null | undefined): string {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? DATE_TIME.format(value) : '—';
}
