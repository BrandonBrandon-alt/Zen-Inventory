import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { parseDate } from '@shared/format/format';

type SaleResponse = components['schemas']['SaleResponse'];

/** Una venta con lo que necesitan los reportes. */
export interface ReportSale {
  readonly date: Date | null;
  /** `CANCELED` no suma a lo vendido; cualquier otro estado sí. */
  readonly canceled: boolean;
  readonly seller: string;
  readonly branchName: string;
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
  readonly globalDiscountPct: number;
  readonly lines: readonly { productName: string; quantity: number; subtotal: number }[];
}

function toReportSale(raw: SaleResponse): ReportSale | null {
  if (typeof raw.id !== 'number') return null;
  return {
    date: parseDate(raw.date),
    canceled: raw.status === 'CANCELED',
    seller: raw.userName?.trim() ?? '',
    branchName: raw.branchName?.trim() ?? '',
    subtotal: raw.subtotal ?? 0,
    discount: raw.totalDiscount ?? 0,
    total: raw.totalFinal ?? 0,
    globalDiscountPct: raw.globalDiscountPercentage ?? 0,
    lines: (raw.details ?? []).map((d) => ({
      productName: d.productName?.trim() || `Producto ${d.productId ?? ''}`.trim(),
      quantity: d.quantity ?? 0,
      subtotal: d.subtotalLine ?? 0,
    })),
  };
}

@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Ventas que el servidor deja ver a quien consulta (el ADMIN puede pedir una sucursal con `branchId`). */
  sales(branchId: number | null): Observable<ReportSale[]> {
    return this.http
      .get<SaleResponse[]>(`${this.baseUrl}/api/v1/sales`, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        ...(branchId !== null ? { params: { branchId } } : {}),
      })
      .pipe(map((items) => items.map(toReportSale).filter((s): s is ReportSale => s !== null)));
  }
}
