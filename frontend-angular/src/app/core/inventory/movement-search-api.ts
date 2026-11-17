import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import { toIsoDay } from '@shared/format/format';
import type { components } from '@core/api/schema';

type MovementAuditResponse = components['schemas']['MovementAuditResponse'];
type MovementAuditPageResponse = components['schemas']['MovementAuditPageResponse'];

export const MOVEMENT_REASONS = ['VENTA', 'COMPRA', 'TRASLADO', 'MERMA', 'DEVOLUCION', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];
export type MovementType = 'INGRESO' | 'RETIRO';

/** Un movimiento de existencias: qué pasó, dónde, quién, con qué documento y el saldo que dejó. Lo usan la auditoría y el kardex. */
export interface MovementRecord {
  readonly id: number;
  readonly date: Date;
  readonly type: MovementType;
  readonly reason: MovementReason;
  readonly subReason: string;
  readonly quantity: number;
  /** Existencias de la sucursal después del movimiento. */
  readonly balance: number | null;
  readonly productId: number;
  readonly productName: string;
  readonly branchId: number;
  readonly branchName: string;
  readonly userId: number | null;
  readonly userName: string;
  readonly referenceType: string;
  readonly referenceId: number | null;
  readonly observations: string;
}

/** Filtros, orden y página que se piden al servidor. `page` empieza en 1, como en la tabla. */
export interface MovementQuery {
  readonly page: number;
  readonly size: number;
  /** Campo de orden del servidor: date, branch, product, type, reason, quantity, balance, responsible o document. */
  readonly sortBy: string;
  readonly ascending: boolean;
  readonly branchId: number | null;
  readonly type: MovementType | null;
  readonly reasons: readonly MovementReason[];
  readonly from: Date | null;
  readonly to: Date | null;
  readonly productIds: readonly number[];
  readonly userId: number | null;
  readonly minQuantity: number | null;
  readonly maxQuantity: number | null;
  readonly onlyObserved: boolean;
  readonly text: string;
}

export interface MovementPage {
  readonly movements: MovementRecord[];
  readonly total: number;
  /** Lo que entró y salió en TODO lo filtrado, no solo en la página. */
  readonly totalIn: number;
  readonly totalOut: number;
}

const isReason = (value: unknown): value is MovementReason => (MOVEMENT_REASONS as readonly unknown[]).includes(value);

function toMovement(raw: MovementAuditResponse): MovementRecord | null {
  if (typeof raw.id !== 'number' || typeof raw.productId !== 'number' || typeof raw.branchId !== 'number' || typeof raw.quantity !== 'number') return null;
  if ((raw.type !== 'INGRESO' && raw.type !== 'RETIRO') || !isReason(raw.reason)) return null;
  const date = raw.date ? new Date(raw.date) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  const userId = raw.userId ?? null;
  return {
    id: raw.id,
    date,
    type: raw.type,
    reason: raw.reason,
    subReason: raw.subReason?.trim() ?? '',
    quantity: raw.quantity,
    balance: raw.finalBalance ?? null,
    productId: raw.productId,
    productName: raw.productName?.trim() || `Producto ${raw.productId}`,
    branchId: raw.branchId,
    branchName: raw.branchName?.trim() || `Sede ${raw.branchId}`,
    userId,
    userName: raw.userName?.trim() || (userId === null ? 'Sistema' : `Usuario ${userId}`),
    referenceType: raw.referenceType?.trim() ?? '',
    referenceId: raw.referenceId ?? null,
    observations: raw.observations?.trim() ?? '',
  };
}

const toMovements = (items: readonly MovementAuditResponse[] | undefined): MovementRecord[] =>
  (items ?? []).map(toMovement).filter((m): m is MovementRecord => m !== null);

/** Los filtros y el orden como parámetros; lo vacío no se manda. */
function filterParams(query: MovementQuery): HttpParams {
  let params = new HttpParams().set('sortBy', query.sortBy).set('direction', query.ascending ? 'asc' : 'desc');
  const set = (key: string, value: string | number | null) => {
    if (value !== null && value !== '') params = params.set(key, String(value));
  };
  set('branchId', query.branchId);
  set('type', query.type);
  set('from', query.from ? toIsoDay(query.from) : null);
  set('to', query.to ? toIsoDay(query.to) : null);
  set('userId', query.userId);
  set('minQuantity', query.minQuantity);
  set('maxQuantity', query.maxQuantity);
  for (const reason of query.reasons) params = params.append('reason', reason);
  for (const id of query.productIds) params = params.append('productId', String(id));
  if (query.onlyObserved) params = params.set('onlyObserved', 'true');
  set('q', query.text.trim());
  return params;
}

@Injectable({ providedIn: 'root' })
export class MovementSearchApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

  /**
   * Una página de movimientos: el servidor filtra, ordena y pagina (antes se descargaban todos). Solo el ADMIN recibe
   * los de todas las sucursales; los demás, los de la suya.
   */
  search(query: MovementQuery): Observable<MovementPage> {
    const params = filterParams(query).set('page', String(Math.max(0, query.page - 1))).set('size', String(query.size));
    return this.http.get<MovementAuditPageResponse>(`${this.baseUrl}/api/v1/inventory/movements/search`, { params, context: this.context }).pipe(
      map((page) => ({
        movements: toMovements(page.content),
        total: page.totalElements ?? 0,
        totalIn: page.totalIn ?? 0,
        totalOut: page.totalOut ?? 0,
      })),
    );
  }

  /** Todos los movimientos filtrados, en el orden elegido (hasta 20.000), para exportar a CSV. */
  exportAll(query: MovementQuery): Observable<MovementRecord[]> {
    return this.http
      .get<MovementAuditResponse[]>(`${this.baseUrl}/api/v1/inventory/movements/export`, { params: filterParams(query), context: this.context })
      .pipe(map(toMovements));
  }
}
