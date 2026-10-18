import { describe, expect, it } from 'vitest';
import { buildAreaGeometry, monotonePath, nearestIndex } from './chart-geometry';

const PAD = { top: 10, right: 10, bottom: 20, left: 10 };

describe('buildAreaGeometry', () => {
  it('reparte los puntos a lo ancho y escala la altura al máximo con holgura', () => {
    const g = buildAreaGeometry([0, 50, 100], 120, 120, PAD);
    expect(g.points.map((p) => p.x)).toEqual([10, 60, 110]);
    // base = 10 + 90 = 100; el máximo (100) usa 100/110 de la altura útil (90)
    expect(g.points[0].y).toBeCloseTo(100);
    expect(g.points[2].y).toBeCloseTo(100 - (100 / 110) * 90);
    expect(g.max).toBeCloseTo(110);
  });

  it('el eje parte de cero: una serie constante no se ve plana en el tope', () => {
    const g = buildAreaGeometry([40, 40, 40], 120, 120, PAD);
    expect(g.points[0].y).toBeGreaterThan(10);
    expect(new Set(g.points.map((p) => p.y)).size).toBe(1);
  });

  it('una serie en cero queda sobre la base, sin dividir entre cero', () => {
    const g = buildAreaGeometry([0, 0, 0], 120, 120, PAD);
    expect(g.points.every((p) => p.y === 100)).toBe(true);
    expect(g.max).toBe(1);
  });

  it('un solo punto va al centro y no genera área; sin puntos no hay nada', () => {
    const one = buildAreaGeometry([5], 120, 120, PAD);
    expect(one.points[0].x).toBe(60);
    expect(one.area).toBe('');
    expect(buildAreaGeometry([], 120, 120, PAD)).toMatchObject({ points: [], line: '', area: '' });
  });

  it('el relleno cierra la figura hasta la base', () => {
    const g = buildAreaGeometry([1, 2, 3], 120, 120, PAD);
    expect(g.area.startsWith(g.line)).toBe(true);
    expect(g.area.endsWith('Z')).toBe(true);
  });

  it('los valores negativos se tratan como cero (no hay ingresos por debajo de la base)', () => {
    expect(buildAreaGeometry([-5, 10], 120, 120, PAD).points[0].y).toBe(100);
  });
});

describe('monotonePath', () => {
  const y = (path: string) => [...path.matchAll(/-?\d+(?:\.\d+)?/g)].map((m) => Number(m[0]));

  it('pasa por todos los puntos', () => {
    const path = monotonePath([{ x: 0, y: 10 }, { x: 10, y: 4 }, { x: 20, y: 8 }]);
    expect(path.startsWith('M0,10')).toBe(true);
    expect(path).toContain('10,4');
    expect(path.endsWith('20,8')).toBe(true);
  });

  it('no sobrepasa los puntos: una meseta se mantiene plana (sin rebote)', () => {
    const numbers = y(monotonePath([{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 10 }, { x: 30, y: 0 }]));
    // en el tramo plano ningún punto de control sube o baja de 10
    expect(numbers.slice(0, 14).filter((_, i) => i % 2 === 1).every((v) => v === 10)).toBe(true);
  });

  it('casos de borde: sin puntos, uno y dos', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 1, y: 2 }])).toBe('M1,2');
    expect(monotonePath([{ x: 1, y: 2 }, { x: 3, y: 4 }])).toBe('M1,2L3,4');
  });
});

describe('nearestIndex', () => {
  const points = [{ x: 10, y: 0 }, { x: 60, y: 0 }, { x: 110, y: 0 }];
  it('devuelve el punto más cercano a la coordenada', () => {
    expect(nearestIndex(points, 0)).toBe(0);
    expect(nearestIndex(points, 40)).toBe(1);
    expect(nearestIndex(points, 500)).toBe(2);
  });
  it('sin puntos devuelve -1', () => {
    expect(nearestIndex([], 10)).toBe(-1);
  });
});
