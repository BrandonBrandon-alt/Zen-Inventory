import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import { toIsoDay } from '@shared/format/format';
import type { components } from '@core/api/schema';

type CatalogChangePageResponse = components['schemas']['CatalogChangePageResponse'];
type CatalogChangeResponse = components['schemas']['CatalogChangeResponse'];

export const CHANGED_ENTITIES = ['PRODUCTO', 'USUARIO'] as const;
export type ChangedEntity = (typeof CHANGED_ENTITIES)[number];

/** Un campo que cambió en un producto o un usuario; los valores ya vienen escritos («$ 34.000», «Gerente»). */
export interface CatalogChange {
  readonly id: number;
  readonly date: Date;
  readonly entity: ChangedEntity;
  readonly entityName: string;
  readonly field: string;
  readonly before: string;
  readonly after: string;
  /** Nulo si lo hizo el sistema. */
  readonly userName: string | null;
}

export interface CatalogChangeQuery {
  /** Desde 1, como en la tabla. */
  readonly page: number;
  readonly size: number;
  readonly entity: ChangedEntity | null;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly text: string;
}

export interface CatalogChangePage {
  readonly changes: CatalogChange[];
  readonly total: number;
}

const isEntity = (value: unknown): value is ChangedEntity => (CHANGED_ENTITIES as readonly unknown[]).includes(value);
function toChange(raw: CatalogChangeResponse): CatalogChange | null {
  const date = raw.date ? new Date(raw.date) : null;
  if (typeof raw.id !== 'number' || !date || Number.isNaN(date.getTime()) || !isEntity(raw.entity)) return null;
  return {
    id: raw.id,
    date,
    entity: raw.entity,
    entityName: raw.entityName?.trim() ?? '',
    field: raw.field?.trim() ?? '',
    before: raw.before?.trim() || '—',
    after: raw.after?.trim() || '—',
    userName: raw.userName?.trim() || null,
  };
}

/** Auditoría de los cambios de productos y usuarios (solo ADMIN). */
@Injectable({ providedIn: 'root' })
export class CatalogAuditApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

  search(query: CatalogChangeQuery): Observable<CatalogChangePage> {
    let params = new HttpParams().set('page', String(Math.max(0, query.page - 1))).set('size', String(query.size));
    if (query.entity) params = params.set('entity', query.entity);
    if (query.from) params = params.set('from', toIsoDay(query.from));
    if (query.to) params = params.set('to', toIsoDay(query.to));
    if (query.text.trim()) params = params.set('q', query.text.trim());
    return this.http.get<CatalogChangePageResponse>(`${this.baseUrl}/api/v1/audit/catalog-changes`, { params, context: this.context }).pipe(
      map((page) => ({
        changes: (page.content ?? []).map(toChange).filter((c): c is CatalogChange => c !== null),
        total: page.totalElements ?? 0,
      })),
    );
  }
}
