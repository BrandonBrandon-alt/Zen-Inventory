import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type StockAlertResponse = components['schemas']['StockAlertResponse'];

export const ALERT_TYPES = ['LOW_STOCK', 'TRANSFER_REQUEST', 'RETURN_REQUEST', 'PURCHASE_REQUEST', 'ISSUE_REPORTED', 'VOID_SALE'] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

const isAlertType = (value: unknown): value is AlertType => (ALERT_TYPES as readonly unknown[]).includes(value);

/** Alerta abierta con los campos que la app necesita siempre presentes. */
export interface StockAlert {
  readonly id: number;
  readonly branchId: number;
  readonly productId: number;
  readonly message: string;
  readonly date: Date | null;
  readonly type: AlertType;
}

export type TransferPriority = 'HIGH' | 'NORMAL' | 'LOW';

function toAlert(raw: StockAlertResponse): StockAlert | null {
  if (typeof raw.id !== 'number' || typeof raw.branchId !== 'number' || typeof raw.productId !== 'number') return null;
  if (!raw.message?.trim() || !isAlertType(raw.type)) return null;
  const date = raw.alertDate ? new Date(raw.alertDate) : null;
  return {
    id: raw.id,
    branchId: raw.branchId,
    productId: raw.productId,
    message: raw.message.trim(),
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    type: raw.type,
  };
}

@Injectable({ providedIn: 'root' })
export class AlertsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Las pantallas muestran el error en su propia tabla o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Alertas abiertas, las más recientes primero. `branchId` solo lo respeta el servidor para el ADMIN. */
  list(branchId?: number | null): Observable<StockAlert[]> {
    return this.http
      .get<StockAlertResponse[]>(`${this.baseUrl}/api/v1/alerts`, {
        ...this.options,
        ...(branchId ? { params: { branchId } } : {}),
      })
      .pipe(
        map((items) =>
          items
            .map(toAlert)
            .filter((alert): alert is StockAlert => alert !== null)
            .sort((a, b) => (b.date?.getTime() ?? 0) - (a.date?.getTime() ?? 0)),
        ),
      );
  }

  /** Revisa los niveles de stock de todas las sucursales y crea las alertas que falten (solo ADMIN). */
  scan(): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/api/v1/alerts/scan`, {}, this.options).pipe(map(() => undefined));
  }

  /** Marca la alerta como atendida sin otra acción (ADMIN y MANAGER). */
  resolve(id: number): Observable<void> {
    return this.http.patch<unknown>(`${this.baseUrl}/api/v1/alerts/${id}/resolve`, {}, this.options).pipe(map(() => undefined));
  }

  /** Resuelve pidiendo stock a otra sucursal: crea una solicitud de traslado. */
  resolveViaTransfer(id: number, input: { originBranchId: number; quantity: number; priority: TransferPriority }): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/api/v1/alerts/${id}/resolve/transfer`, input, this.options).pipe(map(() => undefined));
  }

  /** Resuelve comprando al proveedor: crea una orden de compra. */
  resolveViaPurchase(id: number, input: { supplierId: number; quantity: number; leadTimeDays: number }): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/api/v1/alerts/${id}/resolve/purchase`, input, this.options).pipe(map(() => undefined));
  }

  /** Descarta la alerta dejando el motivo (ADMIN y MANAGER). */
  dismiss(id: number, reason: string): Observable<void> {
    return this.http.post<unknown>(`${this.baseUrl}/api/v1/alerts/${id}/resolve/dismiss`, { reason }, this.options).pipe(map(() => undefined));
  }
}
