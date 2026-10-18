import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { parseDate, toLocalIso } from '@shared/format/format';

type TransferResponse = components['schemas']['TransferResponse'];

export const TRANSFER_STATUSES = ['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'WITH_ISSUE', 'UNDER_CLAIM', 'CANCELLED', 'REJECTED'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type TransferPriority = 'HIGH' | 'NORMAL' | 'LOW';

const isStatus = (value: unknown): value is TransferStatus => (TRANSFER_STATUSES as readonly unknown[]).includes(value);
const toPriority = (value: unknown): TransferPriority => (value === 'HIGH' || value === 'LOW' ? value : 'NORMAL');

/** Una persona que intervino en el traslado y cuándo no importa: solo su nombre. */
export interface TransferLine {
  readonly id: number;
  readonly productId: number;
  readonly productName: string;
  readonly requested: number;
  readonly sent: number | null;
  readonly received: number | null;
  readonly missing: number;
}

export interface Transfer {
  readonly id: number;
  readonly status: TransferStatus;
  readonly priority: TransferPriority;
  readonly originBranchId: number;
  readonly destinationBranchId: number;
  readonly requestDate: Date | null;
  readonly estimatedArrival: Date | null;
  readonly actualArrival: Date | null;
  readonly dispatchDate: Date | null;
  readonly carrier: string;
  readonly trackingNumber: string;
  readonly shippingCost: number | null;
  readonly receiptNotes: string;
  readonly resolutionReason: string;
  readonly parentId: number | null;
  readonly requester: string;
  readonly authorizer: string;
  readonly dispatcher: string;
  readonly receiver: string;
  readonly resolver: string;
  readonly lines: readonly TransferLine[];
}

export interface TransferRequestInput {
  readonly originBranchId: number;
  readonly destinationBranchId: number;
  readonly priority: TransferPriority;
  /** `null` = sin fecha estimada. */
  readonly estimatedArrival: Date | null;
  readonly items: readonly { productId: number; quantity: number }[];
}

export interface DispatchInput {
  readonly carrier: string;
  readonly shippingCost: number;
  readonly trackingNumber: string;
  readonly estimatedArrival: Date | null;
  readonly items: readonly { detailId: number; sent: number }[];
}

export interface ReceiveInput {
  readonly notes: string;
  readonly items: readonly { detailId: number; received: number }[];
}

function toTransfer(raw: TransferResponse): Transfer | null {
  if (typeof raw.id !== 'number' || !isStatus(raw.status)) return null;
  if (typeof raw.originBranchId !== 'number' || typeof raw.destinationBranchId !== 'number') return null;
  return {
    id: raw.id,
    status: raw.status,
    priority: toPriority(raw.priority),
    originBranchId: raw.originBranchId,
    destinationBranchId: raw.destinationBranchId,
    requestDate: parseDate(raw.requestDate),
    estimatedArrival: parseDate(raw.estimatedArrivalDate),
    actualArrival: parseDate(raw.actualArrivalDate),
    dispatchDate: parseDate(raw.dispatchDate),
    carrier: raw.carrier?.trim() ?? '',
    trackingNumber: raw.trackingNumber?.trim() ?? '',
    shippingCost: raw.shippingCost ?? null,
    receiptNotes: raw.receiptNotes?.trim() ?? '',
    resolutionReason: raw.reasonResolution?.trim() ?? '',
    parentId: raw.parentTransferId ?? null,
    requester: raw.solicitanteNombre?.trim() ?? '',
    authorizer: raw.autorizadorNombre?.trim() ?? '',
    dispatcher: raw.despachadorNombre?.trim() ?? '',
    receiver: raw.recibidorNombre?.trim() ?? '',
    resolver: raw.resolutorNombre?.trim() ?? '',
    lines: (raw.details ?? []).flatMap((d) =>
      typeof d.id === 'number' && typeof d.productId === 'number'
        ? [
            {
              id: d.id,
              productId: d.productId,
              productName: d.productName?.trim() || `Producto ${d.productId}`,
              requested: d.requestedQuantity ?? 0,
              sent: d.sentQuantity ?? null,
              received: d.receivedQuantity ?? null,
              missing: d.missingQuantity ?? 0,
            },
          ]
        : [],
    ),
  };
}

function requireTransfer(raw: TransferResponse): Transfer {
  const transfer = toTransfer(raw);
  if (!transfer) throw new Error('El servidor devolvió un traslado incompleto.');
  return transfer;
}

@Injectable({ providedIn: 'root' })
export class TransfersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/transfers`;

  // Las pantallas muestran el error en su propia tabla o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Traslados visibles para quien consulta (ADMIN: todos; el resto: los de su sucursal), el más reciente primero. */
  list(): Observable<Transfer[]> {
    return this.http.get<TransferResponse[]>(this.url, this.options).pipe(
      map((items) =>
        items
          .map(toTransfer)
          .filter((t): t is Transfer => t !== null)
          .sort((a, b) => b.id - a.id),
      ),
    );
  }

  request(input: TransferRequestInput): Observable<Transfer> {
    return this.http
      .post<TransferResponse>(
        this.url,
        {
          originBranchId: input.originBranchId,
          destinationBranchId: input.destinationBranchId,
          priority: input.priority,
          ...(input.estimatedArrival ? { estimatedArrivalDate: toLocalIso(input.estimatedArrival) } : {}),
          items: input.items.map((i) => ({ productId: i.productId, requestedQuantity: i.quantity })),
        },
        this.options,
      )
      .pipe(map(requireTransfer));
  }

  /** La sucursal que recibe aprueba la solicitud. */
  approve(id: number): Observable<Transfer> {
    return this.http.post<TransferResponse>(`${this.url}/${id}/approve-destination`, {}, this.options).pipe(map(requireTransfer));
  }

  /** La sucursal de origen autoriza la salida. El servidor pide la lista de productos; las cantidades no cambian aquí. */
  prepare(transfer: Transfer): Observable<Transfer> {
    return this.http
      .post<TransferResponse>(
        `${this.url}/${transfer.id}/prepare`,
        { items: transfer.lines.map((l) => ({ productId: l.productId, requestedQuantity: l.requested })) },
        this.options,
      )
      .pipe(map(requireTransfer));
  }

  dispatch(id: number, input: DispatchInput): Observable<Transfer> {
    return this.http
      .post<TransferResponse>(
        `${this.url}/${id}/dispatch`,
        {
          carrier: input.carrier.trim(),
          shippingCost: input.shippingCost,
          ...(input.trackingNumber.trim() ? { trackingNumber: input.trackingNumber.trim() } : {}),
          ...(input.estimatedArrival ? { estimatedArrivalDate: toLocalIso(input.estimatedArrival) } : {}),
          items: input.items.map((i) => ({ detailId: i.detailId, sentQuantity: i.sent })),
        },
        this.options,
      )
      .pipe(map(requireTransfer));
  }

  receive(id: number, input: ReceiveInput): Observable<Transfer> {
    return this.http
      .post<TransferResponse>(
        `${this.url}/${id}/receive`,
        {
          ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
          items: input.items.map((i) => ({ detailId: i.detailId, receivedQuantity: i.received })),
        },
        this.options,
      )
      .pipe(map(requireTransfer));
  }

  cancel(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/cancel`, { reason: reason.trim() }, this.options);
  }

  reject(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/reject`, { reason: reason.trim() }, this.options);
  }

  /** Con novedad: se acepta la diferencia como merma y el traslado queda entregado. */
  resolveAsShrinkage(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/resolve-shrinkage`, {}, this.options);
  }

  /** Con novedad: se crea un traslado nuevo con los faltantes. */
  resolveAsResend(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/resolve-resend`, {}, this.options);
  }

  /** Con novedad: se abre un reclamo (por ejemplo al transportista). */
  resolveAsClaim(id: number): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/resolve-claim`, {}, this.options);
  }
}
