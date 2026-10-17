import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, formatQuantity } from './format';

// Intl separa el símbolo con un espacio duro (U+00A0): se normaliza para comparar.
const NBSP = String.fromCharCode(160);
const plain = (text: string) => text.split(NBSP).join(' ');

describe('format', () => {
  it('formatMoney: pesos con separador de miles, sin decimales innecesarios', () => {
    expect(plain(formatMoney(1250))).toBe('$ 1.250');
    expect(plain(formatMoney(1250.5))).toBe('$ 1.250,5');
    expect(plain(formatMoney(0))).toBe('$ 0');
  });

  it('formatQuantity: miles y hasta 4 decimales', () => {
    expect(formatQuantity(1234)).toBe('1.234');
    expect(formatQuantity(12345)).toBe('12.345');
    expect(formatQuantity(2.5)).toBe('2,5');
    expect(formatQuantity(0.12345)).toBe('0,1235');
  });

  it('lo que no es un número (o una fecha) válido se muestra como guion', () => {
    expect(formatMoney(null)).toBe('—');
    expect(formatMoney(undefined)).toBe('—');
    expect(formatMoney(Number.NaN)).toBe('—');
    expect(formatQuantity(null)).toBe('—');
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(new Date('no es fecha'))).toBe('—');
  });

  it('formatDateTime: fecha y hora legibles', () => {
    const text = formatDateTime(new Date(2026, 0, 2, 15, 30));
    expect(text).toContain('2026');
    expect(text).toMatch(/15:30|3:30/);
  });
});
