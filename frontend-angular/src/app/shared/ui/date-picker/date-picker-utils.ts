/** Funciones de fecha del selector. Todas trabajan en hora local y devuelven fechas nuevas (nunca modifican la recibida). */

const MONTH_LONG = new Intl.DateTimeFormat('es-CO', { month: 'long', year: 'numeric' });
const DAY_LONG = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DAY_SHORT = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });

/** Encabezado de columnas con la semana empezando en lunes: letra visible y nombre completo para lectores de pantalla. */
export const WEEKDAYS: readonly { short: string; long: string }[] = [
  { short: 'L', long: 'lunes' },
  { short: 'M', long: 'martes' },
  { short: 'X', long: 'miércoles' },
  { short: 'J', long: 'jueves' },
  { short: 'V', long: 'viernes' },
  { short: 'S', long: 'sábado' },
  { short: 'D', long: 'domingo' },
];

export const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const startOfMonth = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

export const isSameDay = (a: Date | null, b: Date | null): boolean =>
  a !== null && b !== null && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const addDays = (date: Date, days: number): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);

/** Suma meses conservando el día; si el mes destino no lo tiene (31 de enero + 1), queda en su último día. */
export function addMonths(date: Date, months: number): Date {
  const target = new Date(date.getFullYear(), date.getMonth() + months, 1);
  const lastDay = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  return new Date(target.getFullYear(), target.getMonth(), Math.min(date.getDate(), lastDay));
}

/** Lunes de la semana de la fecha. */
export function startOfWeek(date: Date): Date {
  const offset = (date.getDay() + 6) % 7; // lunes = 0
  return addDays(startOfDay(date), -offset);
}

/** Las seis semanas (de lunes a domingo) que se dibujan para un mes: incluyen los días vecinos que completan la cuadrícula. */
export function monthGrid(month: Date): Date[][] {
  const first = startOfWeek(startOfMonth(month));
  return Array.from({ length: 6 }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(first, week * 7 + day)));
}

/** Un día no se puede elegir si cae antes del día del mínimo o después del día del máximo (la hora no cuenta). */
export function isDayDisabled(day: Date, min: Date | null, max: Date | null): boolean {
  const time = startOfDay(day).getTime();
  return (min !== null && time < startOfDay(min).getTime()) || (max !== null && time > startOfDay(max).getTime());
}

/** Acerca la fecha al rango permitido (por día): antes del mínimo queda en el mínimo; después del máximo, en el máximo. */
export function clampDay(day: Date, min: Date | null, max: Date | null): Date {
  if (min !== null && startOfDay(day) < startOfDay(min)) return startOfDay(min);
  if (max !== null && startOfDay(day) > startOfDay(max)) return startOfDay(max);
  return startOfDay(day);
}

/** `15 oct 2026`, o con hora: `15 oct 2026, 14:30`. */
export function formatTrigger(date: Date, withTime: boolean): string {
  const text = DAY_SHORT.format(date).replace(/ de /g, ' ').replace(/\./g, '');
  return withTime ? `${text}, ${toTimeValue(date)}` : text;
}

/** `octubre de 2026`. */
export const monthLabel = (date: Date): string => MONTH_LONG.format(date);

/** `jueves, 15 de octubre de 2026`: el nombre accesible de cada día. */
export const dayLabel = (date: Date): string => DAY_LONG.format(date);

const pad = (n: number): string => String(n).padStart(2, '0');

/** `14:30`: lo que entiende `<input type="time">`. */
export const toTimeValue = (date: Date): string => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** Une un día con una hora `HH:mm`; una hora inválida deja las 00:00. */
export function withTime(day: Date, time: string): Date {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  const hours = match ? Math.min(23, Number(match[1])) : 0;
  const minutes = match ? Math.min(59, Number(match[2])) : 0;
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), hours, minutes);
}

/** Clave estable de un día para localizar su botón: `2026-10-15`. */
export const dayKey = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
