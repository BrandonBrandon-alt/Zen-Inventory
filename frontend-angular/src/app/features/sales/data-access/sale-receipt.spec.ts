import { describe, expect, it } from 'vitest';
import { DEFAULT_COMPANY } from '@core/company/company-info';
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
  paymentMethod: 'TARJETA',
  paymentReference: 'V-9',
  subtotal: 5000,
  discount: 500,
  total: 4500,
  globalDiscountPct: 10,
  cancellationReason: '',
  lines: [{ id: 1, productId: 1, productName: 'Tornillo', quantity: 2, unitPrice: 2500, discountPct: 0, subtotal: 5000 }],
  ...extra,
});

describe('buildSaleReceiptHtml', () => {
  it('muestra la forma de pago y su referencia; una venta anterior al registro dice «Sin registrar»', () => {
    const html = buildSaleReceiptHtml(sale());
    expect(html).toContain('Forma de pago');
    expect(html).toContain('Tarjeta');
    expect(html).toContain('V-9');
    expect(buildSaleReceiptHtml(sale({ paymentMethod: null, paymentReference: '' }))).toContain('Sin registrar');
  });

  it('trae número, cliente, productos, descuento y total', () => {
    const html = buildSaleReceiptHtml(sale());
    expect(html).toContain('FACTURA DE VENTA N° FV-000007');
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

  it('imprime los datos de la empresa y el prefijo configurados; lo vacío no se imprime', () => {
    const html = buildSaleReceiptHtml(sale(), { name: 'Ferretería Zen S.A.S.', taxId: '900.123.456-1', address: 'Cra 7 # 12-34', phone: '604 444 0000', invoicePrefix: 'ZN', invoiceFooter: 'Gracias por elegirnos' });
    expect(html).toContain('FERRETERÍA ZEN S.A.S.');
    expect(html).toContain('NIT 900.123.456-1');
    expect(html).toContain('Cra 7 # 12-34');
    expect(html).toContain('Tel. 604 444 0000');
    expect(html).toContain('N° ZN-000007');
    expect(html).toContain('Gracias por elegirnos');
    const bare = buildSaleReceiptHtml(sale(), { ...DEFAULT_COMPANY, invoicePrefix: '' });
    expect(bare).not.toContain('NIT');
    expect(bare).not.toContain('Tel.');
    expect(bare).toContain('N° 000007');
  });

  it('escapa también los datos de la empresa', () => {
    const html = buildSaleReceiptHtml(sale(), { ...DEFAULT_COMPANY, name: '<b>X</b>', address: 'A & B' });
    expect(html).not.toContain('<b>X</b>');
    expect(html).toContain('A &amp; B');
  });

  it('marca como anulada una venta anulada', () => {
    expect(buildSaleReceiptHtml(sale({ status: 'CANCELED' }))).toContain('ANULADA');
  });
});
