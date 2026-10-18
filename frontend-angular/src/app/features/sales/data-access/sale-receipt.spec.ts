import { describe, expect, it } from 'vitest';
import { formatMoney } from '@shared/format/format';
import { buildSaleReceiptHtml } from './sale-receipt';
import type { Sale } from './sales-api';

const sale = (extra: Partial<Sale> = {}): Sale => ({
  id: 7,
  date: new Date(2026, 9, 15, 14, 30),
  status: 'COMPLETED',
  branchId: 10,
  branchName: 'Sede Central',
  seller: 'Laura',
  customerName: 'Ana Pérez',
  customerDocument: '123',
  subtotal: 5000,
  discount: 500,
  total: 4500,
  globalDiscountPct: 10,
  cancellationReason: '',
  lines: [{ id: 1, productId: 1, productName: 'Tornillo', quantity: 2, unitPrice: 2500, discountPct: 0, subtotal: 5000 }],
  ...extra,
});

describe('buildSaleReceiptHtml', () => {
  it('trae número, cliente, productos, descuento y total', () => {
    const html = buildSaleReceiptHtml(sale());
    expect(html).toContain('FACTURA DE VENTA N° 000007');
    expect(html).toContain('Sede Central');
    expect(html).toContain('Ana Pérez');
    expect(html).toContain('Tornillo');
    expect(html).toContain('Descuento (10 % general)');
    expect(html).toContain(formatMoney(4500)); // el espacio tras «$» es no separable
    expect(html).not.toContain('ANULADA');
  });

  it('sin cliente dice que no está registrado y sin descuento no pone la línea', () => {
    const html = buildSaleReceiptHtml(sale({ customerName: '', customerDocument: '', discount: 0, globalDiscountPct: 0 }));
    expect(html).toContain('Cliente sin registrar');
    expect(html).not.toContain('Descuento');
  });

  it('escapa el texto que viene del servidor para que no se interprete como HTML', () => {
    const html = buildSaleReceiptHtml(sale({ customerName: '<img src=x onerror=alert(1)>', lines: [{ id: 1, productId: 1, productName: 'A & B "x"', quantity: 1, unitPrice: 1, discountPct: 0, subtotal: 1 }] }));
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('A &amp; B &quot;x&quot;');
  });

  it('marca como anulada una venta anulada', () => {
    expect(buildSaleReceiptHtml(sale({ status: 'CANCELED' }))).toContain('ANULADA');
  });
});
