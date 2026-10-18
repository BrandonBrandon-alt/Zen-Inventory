import type { SelectOption } from '@shared/ui/select/select';

/** Último instante del día de `date` (el «Hasta» de un rango incluye ese día completo). */
export const endOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
export const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

/** ¿`date` cae en el rango? Cualquiera de los extremos puede faltar; sin fecha, solo entra si no hay rango. */
export function inDateRange(date: Date | null, from: Date | null, to: Date | null): boolean {
  if (from === null && to === null) return true;
  if (date === null) return false;
  return (from === null || date >= startOfDay(from)) && (to === null || date <= endOfDay(to));
}

/** ¿`value` está entre `min` y `max` (inclusive)? Cualquiera de los extremos puede faltar. */
export const inNumberRange = (value: number, min: number | null, max: number | null): boolean => (min === null || value >= min) && (max === null || value <= max);

/** Lo escrito en un campo numérico: el número, o `null` si está vacío o no es un número. */
export function numberFromInput(event: Event): number | null {
  const raw = (event.target as HTMLInputElement).value.trim();
  if (raw === '') return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/**
 * Opciones de un selector armadas con los valores que hay en los datos (sin repetir, ordenadas), más «todos».
 * El valor ya elegido se conserva aunque los datos no lo traigan, para que el filtro se pueda ver y quitar.
 */
export function optionsFrom(values: Iterable<string>, selected: string | null, allLabel: string): SelectOption<string | null>[] {
  const unique = new Set([...values].filter(Boolean));
  if (selected) unique.add(selected);
  return [{ value: null, label: allLabel }, ...[...unique].sort((a, b) => a.localeCompare(b, 'es')).map((value) => ({ value, label: value }))];
}
