import type { ReportSale } from './reports-api';

export interface SellerSummary {
  readonly seller: string;
  readonly sales: number;
  readonly units: number;
  readonly total: number;
  readonly average: number;
}

export interface ProductSummary {
  readonly name: string;
  readonly units: number;
  readonly total: number;
}

export interface SalesReport {
  /** Primer y último día del periodo (inclusive). */
  readonly from: Date;
  readonly to: Date;
  /** Ventas que cuentan (completadas y las que tuvieron devolución). */
  readonly sales: number;
  readonly units: number;
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
  readonly average: number;
  readonly canceledCount: number;
  readonly canceledTotal: number;
  readonly bySeller: readonly SellerSummary[];
  readonly topProducts: readonly ProductSummary[];
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const endOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
const round = (n: number): number => Math.round(n * 100) / 100;

export const isSameDay = (a: Date, b: Date): boolean => startOfDay(a).getTime() === startOfDay(b).getTime();

/**
 * Resume las ventas de un periodo. Una venta anulada no suma a lo vendido (se cuenta aparte); una con devolución
 * sigue contando: el dinero devuelto se ve en Devoluciones. Lo de cada producto ya trae el descuento general.
 */
export function buildSalesReport(sales: readonly ReportSale[], from: Date, to: Date, topLimit = 10): SalesReport {
  const start = startOfDay(from).getTime();
  const end = endOfDay(to).getTime();
  const inRange = sales.filter((s) => s.date !== null && s.date.getTime() >= start && s.date.getTime() <= end);
  const counted = inRange.filter((s) => !s.canceled);
  const canceled = inRange.filter((s) => s.canceled);

  const sellers = new Map<string, { sales: number; units: number; total: number }>();
  const products = new Map<string, { units: number; total: number }>();
  let units = 0;
  for (const sale of counted) {
    const sellerKey = sale.seller || 'Sin vendedor';
    const seller = sellers.get(sellerKey) ?? { sales: 0, units: 0, total: 0 };
    seller.sales += 1;
    seller.total += sale.total;
    for (const line of sale.lines) {
      units += line.quantity;
      seller.units += line.quantity;
      const product = products.get(line.productName) ?? { units: 0, total: 0 };
      product.units += line.quantity;
      product.total += line.subtotal * (1 - sale.globalDiscountPct / 100);
      products.set(line.productName, product);
    }
    sellers.set(sellerKey, seller);
  }

  const total = counted.reduce((sum, s) => sum + s.total, 0);
  return {
    from: startOfDay(from),
    to: startOfDay(to),
    sales: counted.length,
    units,
    subtotal: round(counted.reduce((sum, s) => sum + s.subtotal, 0)),
    discount: round(counted.reduce((sum, s) => sum + s.discount, 0)),
    total: round(total),
    average: counted.length ? round(total / counted.length) : 0,
    canceledCount: canceled.length,
    canceledTotal: round(canceled.reduce((sum, s) => sum + s.total, 0)),
    bySeller: [...sellers]
      .map(([seller, v]) => ({ seller, sales: v.sales, units: v.units, total: round(v.total), average: round(v.total / v.sales) }))
      .sort((a, b) => b.total - a.total || a.seller.localeCompare(b.seller)),
    topProducts: [...products]
      .map(([name, v]) => ({ name, units: v.units, total: round(v.total) }))
      .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))
      .slice(0, topLimit),
  };
}
