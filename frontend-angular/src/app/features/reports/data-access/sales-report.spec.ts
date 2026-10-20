import { describe, expect, it } from 'vitest';
import type { ReportSale } from './reports-api';
import { buildSalesReport, isSameDay } from './sales-report';

const sale = (extra: Partial<ReportSale> = {}): ReportSale => ({
  date: new Date(2026, 9, 15, 10),
  canceled: false,
  branchName: 'Sede Central',
  seller: 'Luis',
  paymentMethod: 'EFECTIVO',
  subtotal: 1000,
  discount: 0,
  total: 1000,
  globalDiscountPct: 0,
  lines: [{ productName: 'Tornillo', quantity: 2, subtotal: 1000 }],
  ...extra,
});

const day = (d: number) => new Date(2026, 9, d);

describe('buildSalesReport', () => {
  it('suma totales, unidades y ticket promedio de las ventas del periodo', () => {
    const r = buildSalesReport([sale(), sale({ subtotal: 3000, total: 3000, lines: [{ productName: 'Tuerca', quantity: 3, subtotal: 3000 }] })], day(15), day(15));
    expect(r).toMatchObject({ sales: 2, units: 5, subtotal: 4000, total: 4000, average: 2000, discount: 0 });
  });

  it('agrupa lo cobrado por forma de pago, deja aparte las anuladas y junta las ventas sin forma de pago', () => {
    const r = buildSalesReport(
      [
        sale({ total: 1000 }),
        sale({ total: 500, paymentMethod: 'TARJETA' }),
        sale({ total: 300, paymentMethod: 'EFECTIVO' }),
        sale({ total: 200, paymentMethod: null }),
        sale({ total: 9999, paymentMethod: 'TARJETA', canceled: true }),
      ],
      day(15),
      day(15),
    );
    expect(r.byPayment).toEqual([
      { method: 'EFECTIVO', sales: 2, total: 1300 },
      { method: 'TARJETA', sales: 1, total: 500 },
      { method: null, sales: 1, total: 200 },
    ]);
    expect(r.byPayment.reduce((sum, p) => sum + p.total, 0)).toBe(r.total);
  });

  it('el rango incluye el día inicial y el final completos y deja fuera lo demás', () => {
    const sales = [
      sale({ date: new Date(2026, 9, 14, 23, 59) }), // antes
      sale({ date: new Date(2026, 9, 15, 0, 0) }),
      sale({ date: new Date(2026, 9, 16, 23, 59, 59) }),
      sale({ date: new Date(2026, 9, 17, 0, 0) }), // después
      sale({ date: null }),
    ];
    expect(buildSalesReport(sales, day(15), day(16)).sales).toBe(2);
  });

  it('una venta anulada no suma, se cuenta aparte; una con devolución sí suma', () => {
    const r = buildSalesReport([sale(), sale({ canceled: true, total: 700, subtotal: 700 }), sale()], day(15), day(15));
    expect(r).toMatchObject({ sales: 2, total: 2000, canceledCount: 1, canceledTotal: 700 });
  });

  it('agrupa por vendedor, el que más vendió primero, y agrupa las ventas sin vendedor', () => {
    const r = buildSalesReport(
      [sale({ seller: 'Luis', total: 1000 }), sale({ seller: 'Sofía', total: 5000, subtotal: 5000 }), sale({ seller: 'Luis', total: 1000 }), sale({ seller: '', total: 10 })],
      day(15),
      day(15),
    );
    expect(r.bySeller.map((s) => [s.seller, s.sales, s.total, s.average])).toEqual([
      ['Sofía', 1, 5000, 5000],
      ['Luis', 2, 2000, 1000],
      ['Sin vendedor', 1, 10, 10],
    ]);
  });

  it('los productos suman lo vendido con el descuento general y se limitan a los primeros', () => {
    const lines = (name: string, qty: number, subtotal: number) => [{ productName: name, quantity: qty, subtotal }];
    const r = buildSalesReport(
      [sale({ globalDiscountPct: 10, lines: lines('A', 1, 1000) }), sale({ lines: lines('A', 2, 2000) }), sale({ lines: lines('B', 1, 100) }), sale({ lines: lines('C', 1, 50) })],
      day(15),
      day(15),
      2,
    );
    expect(r.topProducts).toEqual([
      { name: 'A', units: 3, total: 2900 }, // 1000 × 0,9 + 2000
      { name: 'B', units: 1, total: 100 },
    ]);
  });

  it('sin ventas todo queda en cero', () => {
    expect(buildSalesReport([], day(15), day(15))).toMatchObject({ sales: 0, total: 0, average: 0, bySeller: [], topProducts: [] });
  });
});

describe('isSameDay', () => {
  it('compara solo el día', () => {
    expect(isSameDay(new Date(2026, 9, 15, 1), new Date(2026, 9, 15, 23))).toBe(true);
    expect(isSameDay(new Date(2026, 9, 15), new Date(2026, 9, 16))).toBe(false);
  });
});
