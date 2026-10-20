import { type Company, DEFAULT_COMPANY } from '@core/company/company-info';
import { formatDateTime, formatMoney, formatQuantity } from '@shared/format/format';
import { paymentLabel } from '@core/sales/payment-method';
import { customerLabel } from './sale-labels';
import type { Sale } from './sales-api';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 12px/1.45 -apple-system, 'Segoe UI', sans-serif; color: #111; background: #fff; }
  @page { size: 80mm auto; margin: 4mm; }
  .center { text-align: center; }
  .brand { font-size: 20px; font-weight: 800; letter-spacing: 3px; }
  .muted { color: #666; font-size: 10px; }
  .doc { margin: 10px 0; padding: 5px 8px; border: 1px solid #ccc; border-radius: 4px; font-weight: 700; font-size: 11px; }
  .rule { border-top: 1px dashed #bbb; margin: 10px 0; }
  .label { font-size: 9px; font-weight: 700; color: #777; text-transform: uppercase; letter-spacing: .5px; }
  .strong { font-weight: 700; }
  table { width: 100%; border-collapse: collapse; }
  th { font-size: 9px; font-weight: 700; color: #777; text-transform: uppercase; padding-bottom: 5px; border-bottom: 1px solid #ccc; }
  td { padding: 6px 0; vertical-align: top; border-bottom: 1px solid #eee; font-size: 11px; }
  .num { text-align: right; white-space: nowrap; }
  .qty { text-align: center; padding: 6px 6px; }
  .totals { margin-top: 10px; padding: 8px 10px; background: #f3f3f3; border-radius: 4px; }
  .row { display: flex; justify-content: space-between; gap: 8px; font-size: 11px; margin-bottom: 4px; }
  .total { margin-top: 6px; padding-top: 6px; border-top: 1px solid #ccc; font-size: 14px; font-weight: 800; }
  .void { margin: 8px 0; padding: 4px; border: 2px solid #111; text-align: center; font-weight: 800; letter-spacing: 2px; }
`;

/**
 * Factura de venta en formato de tiquete de 80 mm, lista para imprimir. Todo texto que viene del servidor
 * (productos, cliente, vendedor) se escapa: el documento se escribe como HTML.
 */
export function buildSaleReceiptHtml(sale: Sale, company: Company = DEFAULT_COMPANY): string {
  const number = `${company.invoicePrefix ? company.invoicePrefix + '-' : ''}${String(sale.id).padStart(6, '0')}`;
  const contact = [company.taxId ? `NIT ${company.taxId}` : '', company.address, company.phone ? `Tel. ${company.phone}` : ''].filter(Boolean);
  const lines = sale.lines
    .map(
      (l) => `<tr>
        <td><div class="strong">${escapeHtml(l.productName)}</div><div class="muted">${escapeHtml(formatMoney(l.unitPrice))} c/u${l.discountPct ? ` · desc. ${l.discountPct} %` : ''}</div></td>
        <td class="qty strong">${escapeHtml(formatQuantity(l.quantity))}</td>
        <td class="num strong">${escapeHtml(formatMoney(l.subtotal))}</td>
      </tr>`,
    )
    .join('');
  const discountLabel = sale.globalDiscountPct ? `Descuento (${sale.globalDiscountPct} % general)` : 'Descuento';
  const status = sale.status === 'COMPLETED' ? '' : `<div class="void">${sale.status === 'CANCELED' ? 'ANULADA' : 'DEVUELTA'}</div>`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Factura de venta ${escapeHtml(number)}</title><style>${STYLES}</style></head>
<body>
  <div class="center">
    <div class="brand">${escapeHtml(company.name.toUpperCase())}</div>
    ${contact.map((line) => `<div class="muted">${escapeHtml(line)}</div>`).join('')}
    ${sale.branchName ? `<div class="muted">${escapeHtml(sale.branchName)}</div>` : ''}
    <div class="doc">FACTURA DE VENTA N° ${escapeHtml(number)}</div>
  </div>
  ${status}
  <div class="rule"></div>
  <div class="label">Fecha</div><div class="strong">${escapeHtml(formatDateTime(sale.date))}</div>
  ${sale.seller ? `<div class="label" style="margin-top:6px">Atendido por</div><div class="strong">${escapeHtml(sale.seller)}</div>` : ''}
  <div class="label" style="margin-top:6px">Forma de pago</div>
  <div class="strong">${escapeHtml(paymentLabel(sale.paymentMethod))}${sale.paymentReference ? ` · ${escapeHtml(sale.paymentReference)}` : ''}</div>
  <div class="label" style="margin-top:6px">Cliente</div>
  <div class="strong">${escapeHtml(customerLabel(sale.customerName))}</div>
  ${sale.customerDocument ? `<div class="muted">${escapeHtml(sale.customerDocument)}</div>` : ''}
  <div class="rule"></div>
  <table>
    <thead><tr><th style="text-align:left">Descripción</th><th>Cant.</th><th class="num">Total</th></tr></thead>
    <tbody>${lines}</tbody>
  </table>
  <div class="totals">
    <div class="row"><span>Subtotal</span><span>${escapeHtml(formatMoney(sale.subtotal))}</span></div>
    ${sale.discount > 0 ? `<div class="row"><span>${escapeHtml(discountLabel)}</span><span>− ${escapeHtml(formatMoney(sale.discount))}</span></div>` : ''}
    <div class="row total"><span>TOTAL</span><span>${escapeHtml(formatMoney(sale.total))}</span></div>
  </div>
  <div class="rule"></div>
  <div class="center strong" style="letter-spacing:2px">GRACIAS POR SU COMPRA</div>
  ${company.invoiceFooter ? `<div class="center muted" style="margin-top:6px">${escapeHtml(company.invoiceFooter)}</div>` : ''}
</body></html>`;
}
