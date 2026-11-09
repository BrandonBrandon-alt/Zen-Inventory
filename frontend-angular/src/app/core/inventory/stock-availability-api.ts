import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';

/**
 * Existencia disponible (actual menos comprometida) de cada producto en una sucursal. Sirve para decidir desde dónde
 * pedir un traslado. No trae precios ni costos, por eso se puede consultar la de otra sucursal.
 */
@Injectable({ providedIn: 'root' })
export class StockAvailabilityApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  /** La pantalla decide cómo mostrar el error: sin aviso global duplicado. */
  private readonly options = { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };

  /** Productos con algo disponible para enviar en la sucursal, con su cantidad. Los demás no aparecen. */
  availability(branchId: number): Observable<ReadonlyMap<number, number>> {
    return this.http.get<{ productId?: number; available?: number }[]>(`${this.baseUrl}/api/v1/inventory/branches/${branchId}/availability`, this.options).pipe(
      map((rows) => new Map(rows.flatMap((row) => (typeof row.productId === 'number' && typeof row.available === 'number' && row.available > 0 ? [[row.productId, row.available] as const] : [])))),
    );
  }
}
