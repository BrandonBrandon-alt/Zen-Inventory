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

const COMPACT = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 1 });
const SHORT_DATE = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' });
const SHORT_MONTH = new Intl.DateTimeFormat('es-CO', { month: 'short' });

/** Pesos para cifras grandes: hasta un millón completos (`$ 48.200`); desde ahí en millones (`$ 12,4 M`, `$ 2.100 M`). */
export function formatMoneyCompact(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  if (Math.abs(value) < 1_000_000) return formatMoney(value);
  return `$ ${COMPACT.format(value / 1_000_000)} M`;
}

/** `15 oct`: para ejes y listas donde el año sobra. */
export function formatShortDate(value: Date | null | undefined): string {
  return value instanceof Date && !Number.isNaN(value.getTime()) ? SHORT_DATE.format(value).replace(' de ', ' ') : '—';
}

/** `may.`: mes abreviado de una fecha. */
export function formatShortMonth(value: Date): string {
  return SHORT_MONTH.format(value);
}

/** Fecha y hora locales sin zona (`2026-10-15T08:30:00`): así las espera el backend. */
export function toLocalIso(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}T${p(date.getHours())}:${p(date.getMinutes())}:${p(date.getSeconds())}`;
}

/** Minúsculas y sin acentos: "Panamá" coincide con "panama" al buscar. */
export function normalizeText(text: string): string {
  return text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Fecha que manda el servidor como texto: `null` si falta o no es una fecha válida. */
export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
