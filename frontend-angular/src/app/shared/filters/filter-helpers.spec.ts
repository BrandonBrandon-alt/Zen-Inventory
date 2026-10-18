import { describe, expect, it } from 'vitest';
import { endOfDay, inDateRange, inNumberRange, numberFromInput, optionsFrom } from './filter-helpers';

const d = (day: number, hour = 12) => new Date(2026, 9, day, hour);
const input = (value: string) => ({ target: { value } }) as unknown as Event;

describe('inDateRange', () => {
  it('sin rango todo entra, también lo que no tiene fecha', () => {
    expect(inDateRange(d(5), null, null)).toBe(true);
    expect(inDateRange(null, null, null)).toBe(true);
  });

  it('el día inicial y el final entran completos', () => {
    expect(inDateRange(new Date(2026, 9, 5, 0, 0), d(5, 18), d(8, 3))).toBe(true);
    expect(inDateRange(new Date(2026, 9, 8, 23, 59), d(5), d(8, 3))).toBe(true);
    expect(inDateRange(new Date(2026, 9, 4, 23, 59), d(5), d(8))).toBe(false);
    expect(inDateRange(new Date(2026, 9, 9, 0, 0), d(5), d(8))).toBe(false);
  });

  it('con un solo extremo; y con rango, lo que no tiene fecha queda fuera', () => {
    expect(inDateRange(d(10), d(5), null)).toBe(true);
    expect(inDateRange(d(2), d(5), null)).toBe(false);
    expect(inDateRange(d(2), null, d(5))).toBe(true);
    expect(inDateRange(null, d(5), null)).toBe(false);
  });

  it('endOfDay llega al último milisegundo del día', () => {
    expect(endOfDay(d(5)).getHours()).toBe(23);
  });
});

describe('inNumberRange', () => {
  it('es inclusivo y cada extremo es opcional', () => {
    expect(inNumberRange(10, 10, 10)).toBe(true);
    expect(inNumberRange(9, 10, null)).toBe(false);
    expect(inNumberRange(11, null, 10)).toBe(false);
    expect(inNumberRange(5, null, null)).toBe(true);
  });
});

describe('numberFromInput', () => {
  it('lee números y devuelve null con vacío o texto', () => {
    expect(numberFromInput(input('25000'))).toBe(25000);
    expect(numberFromInput(input(' 1.5 '))).toBe(1.5);
    expect(numberFromInput(input(''))).toBeNull();
    expect(numberFromInput(input('abc'))).toBeNull();
  });
});

describe('optionsFrom', () => {
  it('ordena, quita repetidos y vacíos, y pone «todos» primero', () => {
    expect(optionsFrom(['Sofía', 'Luis', 'Luis', ''], null, 'Todos').map((o) => o.label)).toEqual(['Todos', 'Luis', 'Sofía']);
  });

  it('conserva el valor elegido aunque los datos ya no lo traigan', () => {
    expect(optionsFrom(['Luis'], 'Ana', 'Todos').map((o) => o.value)).toEqual([null, 'Ana', 'Luis']);
  });
});
