import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { parseDate } from '@shared/format/format';

type ReturnResponse = components['schemas']['ReturnRequestResponse'];
type SaleResponse = components['schemas']['SaleResponse'];

export const RETURN_STATUSES = ['PENDIENTE', 'APROBADA', 'RECHAZADA'] as const;
export type ReturnStatus = (typeof RETURN_STATUSES)[number];
const isStatus = (value: unknown): value is ReturnStatus => (RETURN_STATUSES as readonly unknown[]).includes(value);

export interface ReturnLine {
  readonly id: number;
  readonly productId: number;
  readonly quantity: number;
  readonly reason: string;
  /** Lo que se pagó por unidad en la venta (con descuentos). */
  readonly unitPrice: number;
}

export interface ReturnRequest {
  readonly id: number;
  readonly saleId: number;
  readonly branchId: number;
  readonly requesterId: number | null;
  readonly approverId: number | null;
  readonly status: ReturnStatus;
  readonly requestDate: Date | null;
  readonly processedDate: Date | null;
  readonly reason: string;
  readonly approverComment: string;
  readonly lines: readonly ReturnLine[];
  /** Valor a devolver al cliente: Σ cantidad × precio pagado. */
  readonly total: number;
}

/** Una venta sobre la que se puede pedir una devolución, con lo que se vendió de cada producto. */
export interface ReturnableSale {
  readonly id: number;
  readonly date: Date | null;
  readonly branchId: number;
  readonly customerName: string;
  readonly total: number;
  /** `paid` es lo cobrado por la línea, ya con su descuento y el descuento general de la venta. */
  readonly lines: readonly { productId: number; productName: string; quantity: number; paid: number }[];
}

export interface ReturnInput {
  readonly saleId: number;
  readonly branchId: number;
  /** El contrato lo exige aunque el servidor toma al solicitante de la sesión. */
  readonly userId: number;
  readonly reason: string;
  readonly items: readonly { productId: number; quantity: number; reason: string; unitPrice: number }[];
}

function toReturn(raw: ReturnResponse): ReturnRequest | null {
  if (typeof raw.id !== 'number' || typeof raw.saleId !== 'number' || typeof raw.sucursalId !== 'number' || !isStatus(raw.estado)) return null;
  const lines = (raw.items ?? []).flatMap((d): ReturnLine[] =>
    typeof d.id === 'number' && typeof d.productoId === 'number'
      ? [{ id: d.id, productId: d.productoId, quantity: d.cantidad ?? 0, reason: d.motivoEspecifico?.trim() ?? '', unitPrice: d.precioUnidadVenta ?? 0 }]
      : [],
  );
  return {
    id: raw.id,
    saleId: raw.saleId,
    branchId: raw.sucursalId,
    requesterId: raw.solicitanteId ?? null,
    approverId: raw.aprobadorId ?? null,
    status: raw.estado,
    requestDate: parseDate(raw.fechaSolicitud),
    processedDate: parseDate(raw.fechaProcesamiento),
    reason: raw.motivoGeneral?.trim() ?? '',
    approverComment: raw.comentarioAprobador?.trim() ?? '',
    lines,
    total: Math.round(lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) * 100) / 100,
  };
}

function requireReturn(raw: ReturnResponse): ReturnRequest {
  const request = toReturn(raw);
  if (!request) throw new Error('El servidor devolvió una devolución incompleta.');
  return request;
}

@Injectable({ providedIn: 'root' })
export class ReturnsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/returns`;

  // Las pantallas muestran el error en su propia tabla o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Solicitudes de devolución: el ADMIN ve las de todas las sucursales; el resto, las de la suya. Más reciente primero. */
  list(branchId: number | null): Observable<ReturnRequest[]> {
    const url = branchId === null ? this.url : `${this.url}/branch/${branchId}`;
    return this.http.get<ReturnResponse[]>(url, this.options).pipe(
      map((items) =>
        items
          .map(toReturn)
          .filter((r): r is ReturnRequest => r !== null)
          .sort((a, b) => b.id - a.id),
      ),
    );
  }

  /** Ventas de las que se puede pedir una devolución (no las anuladas), con lo vendido de cada producto. */
  sales(): Observable<ReturnableSale[]> {
    return this.http.get<SaleResponse[]>(`${this.baseUrl}/api/v1/sales`, this.options).pipe(
      map((items) =>
        items
          .flatMap((s): ReturnableSale[] => {
            if (typeof s.id !== 'number' || typeof s.branchId !== 'number' || s.status === 'CANCELED') return [];
            return [
              {
                id: s.id,
                date: parseDate(s.date),
                branchId: s.branchId,
                customerName: s.customerName?.trim() ?? '',
                total: s.totalFinal ?? 0,
                lines: (s.details ?? []).flatMap((d) =>
                  typeof d.productId === 'number'
                    ? [
                        {
                          productId: d.productId,
                          productName: d.productName?.trim() || `Producto ${d.productId}`,
                          quantity: d.quantity ?? 0,
                          // El subtotal de la línea ya trae su descuento; falta el descuento general de la venta.
                          paid: (d.subtotalLine ?? (d.unitPriceApplied ?? 0) * (d.quantity ?? 0)) * (1 - (s.globalDiscountPercentage ?? 0) / 100),
                        },
                      ]
                    : [],
                ),
              },
            ];
          })
          .sort((a, b) => b.id - a.id),
      ),
    );
  }

  create(input: ReturnInput): Observable<ReturnRequest> {
    return this.http
      .post<ReturnResponse>(
        this.url,
        {
          saleId: input.saleId,
          branchId: input.branchId,
          requesterId: input.userId,
          generalReason: input.reason.trim(),
          items: input.items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            ...(i.reason.trim() ? { reasonSpecific: i.reason.trim() } : {}),
            unitPricePaid: i.unitPrice,
          })),
        },
        this.options,
      )
      .pipe(map(requireReturn));
  }

  /** Aprueba la devolución: las unidades vuelven al stock de la sucursal (ADMIN y MANAGER). */
  approve(id: number, comment: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/approve`, null, { ...this.options, params: { comment: comment.trim() } });
  }

  reject(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/reject`, null, { ...this.options, params: { reason: reason.trim() } });
  }
}
