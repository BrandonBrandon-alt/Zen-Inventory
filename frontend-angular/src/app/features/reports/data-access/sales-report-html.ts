import type { Company } from '@core/company/company-info';
import { paymentLabel } from '@core/sales/payment-method';
import { formatMoney, formatQuantity } from '@shared/format/format';
import { type SalesReport, isSameDay } from './sales-report';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

const DAY = new Intl.DateTimeFormat('es-CO', { dateStyle: 'long' });
const iso = (d: Date): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Un solo día es un cierre de caja; un rango, un reporte de ventas. */
export const reportTitle = (report: Pick<SalesReport, 'from' | 'to'>): string => (isSameDay(report.from, report.to) ? 'Cierre de caja' : 'Reporte de ventas');

/** Nombre sugerido del archivo (el navegador lo usa al guardar como PDF): `cierre-de-caja-2026-10-18`. */
export function reportFileName(report: Pick<SalesReport, 'from' | 'to'>): string {
  return isSameDay(report.from, report.to) ? `cierre-de-caja-${iso(report.from)}` : `reporte-de-ventas-${iso(report.from)}-a-${iso(report.to)}`;
}

const STYLES = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font: 12px/1.5 -apple-system, 'Segoe UI', sans-serif; color: #111; }
  @page { size: A4; margin: 16mm 14mm; }
  h1 { font-size: 20px; }
  h2 { font-size: 13px; margin: 20px 0 6px; }
  .head { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 10px; }
  .muted { color: #666; font-size: 11px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-top: 14px; }
  .kpi { border: 1px solid #ccc; border-radius: 6px; padding: 8px 10px; }
  .kpi b { display: block; font-size: 16px; margin-top: 2px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; font-size: 10px; text-transform: uppercase; color: #555; border-bottom: 1px solid #999; padding: 4px 6px; }
  td { padding: 5px 6px; border-bottom: 1px solid #e5e5e5; }
  .num { text-align: right; white-space: nowrap; }
  tfoot td { font-weight: 700; border-top: 1px solid #999; border-bottom: 0; }
  .note { margin-top: 18px; font-size: 10px; color: #666; }
  tr { break-inside: avoid; }
`;

/**
 * Documento A4 listo para imprimir o guardar como PDF: totales del periodo, ventas por vendedor y productos más
 * vendidos. Todo texto del servidor (vendedores, productos, empresa) se escapa: se escribe como HTML.
 */
export function buildSalesReportHtml(report: SalesReport, company: Company, branchLabel: string, generatedAt: Date = new Date()): string {
  const title = reportTitle(report);
  const period = isSameDay(report.from, report.to) ? DAY.format(report.from) : `${DAY.format(report.from)} al ${DAY.format(report.to)}`;
  const sellerRows = report.bySeller
    .map(
      (s) => `<tr><td>${escapeHtml(s.seller)}</td><td class="num">${s.sales}</td><td class="num">${escapeHtml(formatQuantity(s.units))}</td><td class="num">${escapeHtml(formatMoney(s.average))}</td><td class="num">${escapeHtml(formatMoney(s.total))}</td></tr>`,
    )
    .join('');
  const productRows = report.topProducts
    .map((p) => `<tr><td>${escapeHtml(p.name)}</td><td class="num">${escapeHtml(formatQuantity(p.units))}</td><td class="num">${escapeHtml(formatMoney(p.total))}</td></tr>`)
    .join('');
  const paymentRows = report.byPayment
    .map((p) => `<tr><td>${escapeHtml(paymentLabel(p.method))}</td><td class="num">${p.sales}</td><td class="num">${escapeHtml(formatMoney(p.total))}</td></tr>`)
    .join('');
  const kpi = (label: string, value: string): string => `<div class="kpi"><span class="muted">${escapeHtml(label)}</span><b>${escapeHtml(value)}</b></div>`;
  const contact = [company.taxId ? `NIT ${company.taxId}` : '', company.address, company.phone ? `Tel. ${company.phone}` : ''].filter(Boolean).join(' · ');

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>${escapeHtml(reportFileName(report))}</title><style>${STYLES}</style></head>
<body>
  <div class="head">
    <div><h1>${escapeHtml(title)}</h1><div>${escapeHtml(period)}</div><div class="muted">${escapeHtml(branchLabel)}</div></div>
    <div style="text-align:right"><b>${escapeHtml(company.name)}</b>${contact ? `<div class="muted">${escapeHtml(contact)}</div>` : ''}</div>
  </div>
  <div class="kpis">
    ${kpi('Total vendido', formatMoney(report.total))}
    ${kpi('Ventas', String(report.sales))}
    ${kpi('Ticket promedio', formatMoney(report.average))}
    ${kpi('Unidades', formatQuantity(report.units))}
  </div>
  <table style="margin-top:12px">
    <tbody>
      <tr><td>Subtotal</td><td class="num">${escapeHtml(formatMoney(report.subtotal))}</td></tr>
      <tr><td>Descuentos</td><td class="num">− ${escapeHtml(formatMoney(report.discount))}</td></tr>
      <tr><td><b>Total vendido</b></td><td class="num"><b>${escapeHtml(formatMoney(report.total))}</b></td></tr>
      <tr><td class="muted">Ventas anuladas (no suman)</td><td class="num muted">${report.canceledCount} · ${escapeHtml(formatMoney(report.canceledTotal))}</td></tr>
    </tbody>
  </table>
  <h2>Cobrado por forma de pago</h2>
  ${
    report.byPayment.length
      ? `<table><thead><tr><th>Forma de pago</th><th class="num">Ventas</th><th class="num">Total</th></tr></thead><tbody>${paymentRows}</tbody>
         <tfoot><tr><td>Total</td><td class="num">${report.sales}</td><td class="num">${escapeHtml(formatMoney(report.total))}</td></tr></tfoot></table>`
      : '<p class="muted">No hubo ventas en este periodo.</p>'
  }
  <h2>Ventas por vendedor</h2>
  ${
    report.bySeller.length
      ? `<table><thead><tr><th>Vendedor</th><th class="num">Ventas</th><th class="num">Unidades</th><th class="num">Ticket promedio</th><th class="num">Total</th></tr></thead><tbody>${sellerRows}</tbody>
         <tfoot><tr><td>Total</td><td class="num">${report.sales}</td><td class="num">${escapeHtml(formatQuantity(report.units))}</td><td></td><td class="num">${escapeHtml(formatMoney(report.total))}</td></tr></tfoot></table>`
      : '<p class="muted">No hubo ventas en este periodo.</p>'
  }
  <h2>Productos más vendidos</h2>
  ${
    report.topProducts.length
      ? `<table><thead><tr><th>Producto</th><th class="num">Unidades</th><th class="num">Total</th></tr></thead><tbody>${productRows}</tbody></table>`
      : '<p class="muted">No hubo ventas en este periodo.</p>'
  }
  <p class="note">Generado el ${escapeHtml(DAY.format(generatedAt))}. Los totales por producto incluyen el descuento general de cada venta. Las ventas anuladas no se incluyen en ningún total.</p>
</body></html>`;
}
