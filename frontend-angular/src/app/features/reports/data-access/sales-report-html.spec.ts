import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPANY } from '@core/company/company-info';
import { formatMoney } from '@shared/format/format';
import { type SalesReport } from './sales-report';
import { buildSalesReportHtml, reportFileName, reportTitle } from './sales-report-html';

const report = (extra: Partial<SalesReport> = {}): SalesReport => ({
  from: new Date(2026, 9, 18),
  to: new Date(2026, 9, 18),
  sales: 2,
  units: 5,
  subtotal: 4500,
  discount: 500,
  total: 4000,
  average: 2000,
  canceledCount: 1,
  canceledTotal: 700,
  bySeller: [{ seller: 'Luis', sales: 2, units: 5, total: 4000, average: 2000 }],
  topProducts: [{ name: 'Tornillo', units: 5, total: 4000 }],
  byPayment: [
    { method: 'EFECTIVO', sales: 1, total: 2500 },
    { method: 'TARJETA', sales: 1, total: 1500 },
  ],
  ...extra,
});

describe('reportes de ventas en HTML', () => {
  it('el cierre de caja trae lo cobrado por cada forma de pago y agrupa lo anterior al registro como «Sin registrar»', () => {
    const html = buildSalesReportHtml(report({ byPayment: [{ method: 'EFECTIVO', sales: 1, total: 2500 }, { method: null, sales: 1, total: 1500 }] }), DEFAULT_COMPANY, 'Sede Central');
    expect(html).toContain('Cobrado por forma de pago');
    expect(html).toContain('Efectivo');
    expect(html).toContain(formatMoney(2500));
    expect(html).toContain('Sin registrar');
  });

  it('un solo día es un cierre de caja; un rango, un reporte de ventas, con su nombre de archivo', () => {
    expect(reportTitle(report())).toBe('Cierre de caja');
    expect(reportFileName(report())).toBe('cierre-de-caja-2026-10-18');
    const range = report({ to: new Date(2026, 9, 25) });
    expect(reportTitle(range)).toBe('Reporte de ventas');
    expect(reportFileName(range)).toBe('reporte-de-ventas-2026-10-18-a-2026-10-25');
  });

  it('trae el periodo, la sucursal, los totales, los vendedores y los productos', () => {
    const html = buildSalesReportHtml(report(), { ...DEFAULT_COMPANY, name: 'Ferretería Zen', taxId: '900' }, 'Sede Central');
    expect(html).toContain('Cierre de caja');
    expect(html).toContain('Sede Central');
    expect(html).toContain('Ferretería Zen');
    expect(html).toContain('NIT 900');
    expect(html).toContain(formatMoney(4000));
    expect(html).toContain('Luis');
    expect(html).toContain('Tornillo');
    expect(html).toContain('Ventas anuladas');
    expect(html).toContain('<title>cierre-de-caja-2026-10-18</title>');
  });

  it('sin ventas lo dice en lugar de dibujar tablas vacías', () => {
    const html = buildSalesReportHtml(report({ sales: 0, bySeller: [], topProducts: [], byPayment: [] }), DEFAULT_COMPANY, 'Todas las sucursales');
    expect(html).not.toContain('<table><thead>');
    expect(html).toContain('No hubo ventas en este periodo.');
  });

  it('escapa lo que viene del servidor', () => {
    const html = buildSalesReportHtml(
      report({ bySeller: [{ seller: '<img src=x onerror=alert(1)>', sales: 1, units: 1, total: 1, average: 1 }], topProducts: [{ name: 'A & "B"', units: 1, total: 1 }] }),
      { ...DEFAULT_COMPANY, name: '<b>Zen</b>' },
      '<script>x</script>',
    );
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<b>Zen</b>');
    expect(html).toContain('A &amp; &quot;B&quot;');
  });
});
