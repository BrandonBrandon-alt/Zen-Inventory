import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { toLocalIso } from '@shared/format/format';

type Schemas = components['schemas'];

export type Range = 'today' | 'week' | 'month';

export interface Summary {
  readonly revenue: number;
  readonly units: number;
  readonly averageTicket: number;
  readonly inventoryValue: number;
}
export interface SeriesPoint {
  readonly date: Date;
  readonly revenue: number;
}
export interface RankedItem {
  readonly id: number;
  readonly name: string;
  readonly value: number;
}
export interface BranchFigures {
  readonly id: number;
  readonly name: string;
  readonly revenue: number;
  readonly sales: number;
}
export interface Overview {
  readonly summary: Summary;
  readonly trend: readonly SeriesPoint[];
  readonly topProducts: readonly RankedItem[];
  readonly valuations: readonly RankedItem[];
  readonly branches: readonly BranchFigures[];
}
export interface MonthlySales {
  readonly month: string;
  readonly year: number;
  readonly revenue: number;
}
export type ReplenishmentPriority = 'HIGH' | 'MEDIUM' | 'LOW';
export interface Replenishment {
  readonly branchId: number;
  readonly branchName: string;
  readonly productId: number;
  readonly name: string;
  readonly stock: number;
  readonly minimum: number;
  readonly priority: ReplenishmentPriority;
}
export interface Rotation {
  readonly productId: number;
  readonly name: string;
  readonly sold: number;
  readonly stock: number;
  readonly ratio: number;
  readonly dead: boolean;
  readonly inactiveDays: number;
}
export interface OpenAlert {
  readonly id: number;
  readonly branchId: number;
  readonly type: string;
  readonly message: string;
  readonly date: Date | null;
}
export interface TransferInProgress {
  readonly id: number;
  readonly status: string;
  readonly originBranchId: number;
  readonly destinationBranchId: number;
  readonly products: number;
}

/** Estados de un traslado que todavía no terminó (ni se canceló ni se cerró con novedad). */
const IN_PROGRESS = new Set(['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT']);

export { toLocalIso };

/**
 * Desde cuándo y hasta cuándo cubre cada periodo. "Hoy" es el día completo; "7 días" son los últimos siete días
 * contando hoy; "Este mes" va desde el día 1. Sin fin significa "hasta ahora".
 */
export function rangeDates(range: Range, now: Date): { start: Date; end: Date | null } {
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (range) {
    case 'today':
      return { start: startOfDay, end: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59) };
    case 'week':
      return { start: new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6), end: null };
    case 'month':
      return { start: new Date(now.getFullYear(), now.getMonth(), 1), end: null };
  }
}

/** Una fecha sin hora (`2026-10-15`) es un día local: `new Date()` la tomaría como UTC y la correría un día atrás. */
export function parseDay(value: string): Date | null {
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const date = day ? new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3])) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

const isRanked = <T extends { id?: number; name?: string }>(item: T): item is T & { id: number; name: string } =>
  typeof item.id === 'number' && typeof item.name === 'string' && item.name.trim() !== '';

@Injectable({ providedIn: 'root' })
export class DashboardApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private get context() {
    // Cada sección del panel muestra su propio error: sin aviso global duplicado.
    return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
  }

  /** Indicadores, tendencia de ingresos, más vendidos, valoración y rendimiento por sede del periodo. */
  overview(range: Range, now: Date = new Date()): Observable<Overview> {
    const { start, end } = rangeDates(range, now);
    let params = new HttpParams().set('startDate', toLocalIso(start));
    if (end) params = params.set('endDate', toLocalIso(end));
    return this.http.get<Schemas['DashboardAnalyticsResponse']>(`${this.baseUrl}/api/v1/analytics/dashboard`, { params, context: this.context }).pipe(
      map((raw): Overview => ({
        summary: {
          revenue: raw.summary?.totalRevenue ?? 0,
          units: raw.summary?.totalUnitsSold ?? 0,
          averageTicket: raw.summary?.averageTicket ?? 0,
          inventoryValue: raw.summary?.totalInventoryValue ?? 0,
        },
        trend: (raw.salesTrend ?? []).flatMap((point) => {
          const date = point.saleDate ? parseDay(point.saleDate) : null;
          return date ? [{ date, revenue: point.revenue ?? 0 }] : [];
        }).sort((a, b) => a.date.getTime() - b.date.getTime()),
        topProducts: (raw.topProducts ?? [])
          .map((p) => ({ id: p.productId, name: p.productName, value: p.totalSoldQuantity ?? 0 }))
          .filter(isRanked),
        valuations: (raw.valuations ?? [])
          .map((v) => ({ id: v.branchId, name: v.branchName, value: v.totalValue ?? 0 }))
          .filter(isRanked)
          .sort((a, b) => b.value - a.value),
        branches: (raw.performance ?? [])
          .map((b) => ({ id: b.branchId, name: b.branchName, revenue: b.revenue ?? 0, sales: b.salesCount ?? 0 }))
          .filter(isRanked)
          .sort((a, b) => b.revenue - a.revenue),
      })),
    );
  }

  /** Ventas de los últimos meses. */
  monthly(): Observable<MonthlySales[]> {
    return this.http.get<Schemas['MonthlySales'][]>(`${this.baseUrl}/api/v1/analytics/monthly-sales`, { context: this.context }).pipe(
      map((items) => items.flatMap((m) => (m.monthName && typeof m.year === 'number' ? [{ month: m.monthName, year: m.year, revenue: m.revenue ?? 0 }] : []))),
    );
  }

  /** Productos por reponer, los urgentes primero. */
  replenishment(): Observable<Replenishment[]> {
    const order: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    return this.http.get<Schemas['ReplenishmentInsight'][]>(`${this.baseUrl}/api/v1/analytics/replenishment-insights`, { context: this.context }).pipe(
      map((items) =>
        items
          .flatMap((i): Replenishment[] =>
            typeof i.productId === 'number' && typeof i.branchId === 'number' && i.productName
              ? [{ branchId: i.branchId, branchName: i.branchName?.trim() ?? '', productId: i.productId, name: i.productName, stock: i.currentStock ?? 0, minimum: i.minStock ?? 0, priority: i.priority === 'HIGH' || i.priority === 'LOW' ? i.priority : 'MEDIUM' }]
              : [],
          )
          .sort((a, b) => order[a.priority] - order[b.priority] || a.stock - a.minimum - (b.stock - b.minimum)),
      ),
    );
  }

  /** Rotación de inventario; los productos sin movimiento primero. */
  rotation(): Observable<Rotation[]> {
    return this.http.get<Schemas['InventoryRotation'][]>(`${this.baseUrl}/api/v1/analytics/inventory-rotation`, { context: this.context }).pipe(
      map((items) =>
        items
          .flatMap((i): Rotation[] =>
            typeof i.productId === 'number' && i.productName
              ? [{ productId: i.productId, name: i.productName, sold: i.soldQuantity ?? 0, stock: i.currentStock ?? 0, ratio: i.rotationRatio ?? 0, dead: i.isDeadStock === true, inactiveDays: i.inactiveDays ?? 0 }]
              : [],
          )
          .sort((a, b) => Number(b.dead) - Number(a.dead) || b.inactiveDays - a.inactiveDays),
      ),
    );
  }

  /** Alertas abiertas que no son de stock bajo (las de stock ya se ven como "por reponer"). */
  alerts(): Observable<OpenAlert[]> {
    return this.http.get<Schemas['StockAlertResponse'][]>(`${this.baseUrl}/api/v1/alerts`, { context: this.context }).pipe(
      map((items) =>
        items.flatMap((a): OpenAlert[] =>
          typeof a.id === 'number' && typeof a.branchId === 'number' && a.message && a.resolved !== true && a.type !== 'LOW_STOCK'
            ? [{ id: a.id, branchId: a.branchId, type: a.type ?? '', message: a.message, date: a.alertDate ? parseDay(a.alertDate) : null }]
            : [],
        ),
      ),
    );
  }

  /** Traslados que todavía no terminaron. */
  transfersInProgress(): Observable<TransferInProgress[]> {
    return this.http.get<Schemas['TransferResponse'][]>(`${this.baseUrl}/api/v1/transfers`, { context: this.context }).pipe(
      map((items) =>
        items.flatMap((t): TransferInProgress[] =>
          typeof t.id === 'number' && typeof t.originBranchId === 'number' && typeof t.destinationBranchId === 'number' && t.status && IN_PROGRESS.has(t.status)
            ? [{ id: t.id, status: t.status, originBranchId: t.originBranchId, destinationBranchId: t.destinationBranchId, products: t.details?.length ?? 0 }]
            : [],
        ),
      ),
    );
  }
}
