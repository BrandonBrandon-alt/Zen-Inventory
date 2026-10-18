import { describe, expect, it } from 'vitest';
import { parseDay, rangeDates, toLocalIso } from './dashboard-api';

describe('fechas del Panel', () => {
  const now = new Date(2026, 9, 15, 14, 30, 5); // 15 oct 2026, 14:30:05 local

  it('toLocalIso escribe la hora local sin zona', () => {
    expect(toLocalIso(now)).toBe('2026-10-15T14:30:05');
  });

  it('"Hoy" cubre el día completo', () => {
    const { start, end } = rangeDates('today', now);
    expect(toLocalIso(start)).toBe('2026-10-15T00:00:00');
    expect(toLocalIso(end as Date)).toBe('2026-10-15T23:59:59');
  });

  it('"7 días" empieza seis días antes de hoy y no tiene fin', () => {
    const { start, end } = rangeDates('week', now);
    expect(toLocalIso(start)).toBe('2026-10-09T00:00:00');
    expect(end).toBeNull();
  });

  it('"Este mes" empieza el día 1, incluso cruzando de año en la resta de días', () => {
    expect(toLocalIso(rangeDates('month', now).start)).toBe('2026-10-01T00:00:00');
    expect(toLocalIso(rangeDates('week', new Date(2026, 0, 3)).start)).toBe('2025-12-28T00:00:00');
  });

  it('parseDay toma "2026-10-15" como día local (no corre un día por la zona horaria)', () => {
    const date = parseDay('2026-10-15');
    expect(date?.getDate()).toBe(15);
    expect(date?.getHours()).toBe(0);
  });

  it('parseDay devuelve null con un texto que no es fecha', () => {
    expect(parseDay('mañana')).toBeNull();
  });
});
