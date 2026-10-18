import { describe, expect, it } from 'vitest';
import {
  addDays,
  addMonths,
  clampDay,
  dayKey,
  dayLabel,
  formatTrigger,
  isDayDisabled,
  isSameDay,
  monthGrid,
  monthLabel,
  startOfDay,
  startOfMonth,
  startOfWeek,
  toTimeValue,
  withTime,
} from './date-picker-utils';

const d = (y: number, m: number, day: number, h = 0, min = 0) => new Date(y, m - 1, day, h, min);

describe('date-picker-utils', () => {
  it('startOfDay y startOfMonth conservan solo lo que corresponde', () => {
    expect(startOfDay(d(2026, 10, 15, 14, 30))).toEqual(d(2026, 10, 15));
    expect(startOfMonth(d(2026, 10, 15, 14, 30))).toEqual(d(2026, 10, 1));
  });

  it('isSameDay compara el día, no la hora, y tolera null', () => {
    expect(isSameDay(d(2026, 10, 15, 1), d(2026, 10, 15, 23))).toBe(true);
    expect(isSameDay(d(2026, 10, 15), d(2026, 11, 15))).toBe(false);
    expect(isSameDay(null, d(2026, 10, 15))).toBe(false);
  });

  it('addDays cruza meses y años', () => {
    expect(addDays(d(2026, 10, 31), 1)).toEqual(d(2026, 11, 1));
    expect(addDays(d(2026, 12, 31), 1)).toEqual(d(2027, 1, 1));
    expect(addDays(d(2026, 3, 1), -1)).toEqual(d(2026, 2, 28));
  });

  it('addMonths conserva el día y, si el mes destino no lo tiene, queda en su último día', () => {
    expect(addMonths(d(2026, 10, 15), 1)).toEqual(d(2026, 11, 15));
    expect(addMonths(d(2026, 1, 31), 1)).toEqual(d(2026, 2, 28));
    expect(addMonths(d(2028, 1, 31), 1)).toEqual(d(2028, 2, 29)); // bisiesto
    expect(addMonths(d(2026, 3, 31), -1)).toEqual(d(2026, 2, 28));
    expect(addMonths(d(2026, 12, 15), 1)).toEqual(d(2027, 1, 15));
    expect(addMonths(d(2026, 1, 15), -1)).toEqual(d(2025, 12, 15));
  });

  it('startOfWeek devuelve el lunes (el domingo pertenece a la semana que termina)', () => {
    expect(startOfWeek(d(2026, 10, 15))).toEqual(d(2026, 10, 12)); // jueves
    expect(startOfWeek(d(2026, 10, 12))).toEqual(d(2026, 10, 12)); // lunes
    expect(startOfWeek(d(2026, 10, 18))).toEqual(d(2026, 10, 12)); // domingo
  });

  describe('monthGrid', () => {
    it('son seis semanas de siete días, de lunes a domingo, e incluyen los días vecinos', () => {
      const grid = monthGrid(d(2026, 10, 15));
      expect(grid).toHaveLength(6);
      expect(grid.every((week) => week.length === 7)).toBe(true);
      // Octubre de 2026 empieza en jueves: la cuadrícula arranca el lunes 28 de septiembre.
      expect(grid[0][0]).toEqual(d(2026, 9, 28));
      expect(grid[0][3]).toEqual(d(2026, 10, 1));
      expect(grid[5][6]).toEqual(d(2026, 11, 8));
    });

    it('un mes que empieza en lunes no tiene días del mes anterior', () => {
      expect(monthGrid(d(2026, 6, 10))[0][0]).toEqual(d(2026, 6, 1)); // junio de 2026 empieza en lunes
    });

    it('un mes que empieza en domingo arranca seis días antes', () => {
      expect(monthGrid(d(2026, 11, 1))[0][0]).toEqual(d(2026, 10, 26));
    });

    it('los días son consecutivos', () => {
      const days = monthGrid(d(2028, 2, 1)).flat();
      days.slice(1).forEach((day, i) => expect(day).toEqual(addDays(days[i], 1)));
    });
  });

  describe('rango permitido', () => {
    const min = d(2026, 10, 10, 14, 30);
    const max = d(2026, 10, 20, 9, 0);

    it('un día es elegible si cae entre el día del mínimo y el del máximo, sin importar la hora', () => {
      expect(isDayDisabled(d(2026, 10, 9), min, max)).toBe(true);
      expect(isDayDisabled(d(2026, 10, 10), min, max)).toBe(false); // el día del mínimo cuenta aunque su hora ya pasó
      expect(isDayDisabled(d(2026, 10, 20, 23), min, max)).toBe(false);
      expect(isDayDisabled(d(2026, 10, 21), min, max)).toBe(true);
    });

    it('sin límites todo día es elegible', () => {
      expect(isDayDisabled(d(1999, 1, 1), null, null)).toBe(false);
    });

    it('clampDay acerca un día fuera de rango al límite más cercano', () => {
      expect(clampDay(d(2026, 10, 1), min, max)).toEqual(d(2026, 10, 10));
      expect(clampDay(d(2026, 11, 1), min, max)).toEqual(d(2026, 10, 20));
      expect(clampDay(d(2026, 10, 15, 8), min, max)).toEqual(d(2026, 10, 15));
    });
  });

  describe('texto', () => {
    it('formatTrigger: día, mes corto y año; con hora la agrega', () => {
      expect(formatTrigger(d(2026, 10, 15), false)).toBe('15 oct 2026');
      expect(formatTrigger(d(2026, 10, 5, 9, 5), true)).toBe('5 oct 2026, 09:05');
    });

    it('monthLabel y dayLabel están en español', () => {
      expect(monthLabel(d(2026, 10, 15))).toBe('octubre de 2026');
      expect(dayLabel(d(2026, 10, 15))).toBe('jueves, 15 de octubre de 2026');
    });
  });

  describe('hora', () => {
    it('toTimeValue rellena con ceros', () => {
      expect(toTimeValue(d(2026, 10, 15, 9, 5))).toBe('09:05');
    });

    it('withTime une un día con una hora HH:mm', () => {
      expect(withTime(d(2026, 10, 15), '14:30')).toEqual(d(2026, 10, 15, 14, 30));
      expect(withTime(d(2026, 10, 15, 8, 8), '7:05')).toEqual(d(2026, 10, 15, 7, 5));
    });

    it('una hora inválida o fuera de rango no rompe: queda en medianoche o se limita', () => {
      expect(withTime(d(2026, 10, 15), '')).toEqual(d(2026, 10, 15));
      expect(withTime(d(2026, 10, 15), 'abc')).toEqual(d(2026, 10, 15));
      expect(withTime(d(2026, 10, 15), '31:99')).toEqual(d(2026, 10, 15, 23, 59));
    });
  });

  it('dayKey es estable y ordenable', () => {
    expect(dayKey(d(2026, 10, 5))).toBe('2026-10-05');
    expect(dayKey(d(2026, 1, 15)) < dayKey(d(2026, 10, 5))).toBe(true);
  });
});
