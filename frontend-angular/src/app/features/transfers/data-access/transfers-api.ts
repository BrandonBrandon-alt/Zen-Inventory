import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, type Observable, expand, map, reduce } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { StockAvailabilityApi } from '@core/inventory/stock-availability-api';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { type PaymentMethod, isPaymentMethod } from '@core/payments/payment-method';
import { parseDate, toIsoDay, toLocalIso } from '@shared/format/format';

type TransferResponse = components['schemas']['TransferResponse'];
type TransferRowResponse = components['schemas']['TransferRowResponse'];
type TransferPageResponse = components['schemas']['TransferPageResponse'];
type TransferSummaryResponse = components['schemas']['TransferSummaryResponse'];

export const TRANSFER_STATUSES = ['PENDING', 'APPROVED_DEST', 'PREPARING', 'IN_TRANSIT', 'DELIVERED', 'WITH_ISSUE', 'UNDER_CLAIM', 'CANCELLED', 'REJECTED'] as const;
export type TransferStatus = (typeof TRANSFER_STATUSES)[number];
export type TransferPriority = 'HIGH' | 'NORMAL' | 'LOW';

export const FREIGHT_STATUSES = ['SIN_COSTO', 'POR_PAGAR', 'PAGO_PARCIAL', 'PAGADO'] as const;
export type FreightStatus = (typeof FREIGHT_STATUSES)[number];
const toFreightStatus = (value: unknown): FreightStatus => ((FREIGHT_STATUSES as readonly unknown[]).includes(value) ? (value as FreightStatus) : 'SIN_COSTO');

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

/** Un pago o abono del flete al transportista. */
export interface FreightPayment {
  readonly id: number;
  readonly amount: number;
  readonly date: Date | null;
  readonly userName: string;
  readonly method: PaymentMethod;
  readonly reference: string;
  readonly notes: string;
  /** Si se anuló (contra-asiento): cuándo, quién y por qué. Un pago anulado no cuenta en lo pagado. */
  readonly voided: { readonly date: Date | null; readonly by: string; readonly reason: string } | null;
}

/** Lo que se envía para registrar un pago del flete; sin `amount` se paga todo el saldo. */
export interface FreightPaymentInput {
  readonly amount: number | null;
  readonly method: PaymentMethod;
  readonly reference: string;
  readonly notes: string;
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
  /** Lo ya pagado del flete. */
  readonly freightPaid: number;
  /** Lo que aún se le debe al transportista. */
  readonly freightBalance: number;
  readonly freightStatus: FreightStatus;
  readonly payments: readonly FreightPayment[];
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
    freightPaid: raw.freightPaid ?? 0,
    freightBalance: raw.freightBalance ?? 0,
    freightStatus: toFreightStatus(raw.freightStatus),
    payments: (raw.payments ?? []).flatMap((p) =>
      typeof p.id === 'number'
        ? [
            {
              id: p.id,
              amount: p.amount ?? 0,
              date: parseDate(p.date),
              userName: p.userName?.trim() || 'Desconocido',
              method: isPaymentMethod(p.method) ? p.method : 'OTRO',
              reference: p.reference?.trim() ?? '',
              notes: p.notes?.trim() ?? '',
              voided: p.voidedAt ? { date: parseDate(p.voidedAt), by: p.voidedByUserName?.trim() || 'Desconocido', reason: p.voidReason?.trim() ?? '' } : null,
            },
          ]
        : [],
    ),
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

/** Una fila de la lista de traslados: lo que muestra la tabla, sin líneas ni pagos (el detalle se pide al abrirla). */
export interface TransferListRow {
  readonly id: number;
  readonly status: TransferStatus;
  readonly priority: TransferPriority;
  readonly originBranchId: number;
  readonly originName: string;
  readonly destinationBranchId: number;
  readonly destinationName: string;
  /** El primer producto y cuántos lleva en total (la tabla muestra «Cemento +2»). */
  readonly firstProductName: string | null;
  readonly productCount: number;
  readonly freightStatus: FreightStatus;
  readonly freightBalance: number;
  readonly requestDate: Date | null;
  /** Espera una acción de quien mira (lo decide el servidor). */
  readonly awaitsMe: boolean;
}

/** Campos por los que el servidor sabe ordenar. */
export type TransferSortField = 'id' | 'status' | 'route' | 'priority' | 'freight' | 'requestDate';
export type TransferFlow = 'all' | 'incoming' | 'outgoing';

export interface TransferQuery {
  /** Desde 1, como en la tabla. */
  readonly page: number;
  readonly size: number;
  readonly sortBy: TransferSortField;
  readonly ascending: boolean;
  readonly status: 'open' | 'all' | TransferStatus;
  /** Entrantes (llegan a la sucursal propia) o salientes (salen de ella). */
  readonly flow: TransferFlow;
  readonly priority: TransferPriority | null;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly originId: number | null;
  readonly destinationId: number | null;
  readonly productId: number | null;
  readonly onlyMine: boolean;
  readonly text: string;
}

export interface TransferListPage {
  readonly transfers: TransferListRow[];
  readonly total: number;
}

/** Los totales del encabezado, sobre todo lo que ve quien mira. */
export interface TransferSummary {
  readonly open: number;
  readonly awaitingMe: number;
  readonly freightOwed: number;
  readonly freightOwedCount: number;
}

/** Filas por petición al exportar (el máximo del servidor) y tope de páginas. */
const EXPORT_PAGE_SIZE = 100;
const EXPORT_MAX_PAGES = 200;

function toListRow(raw: TransferRowResponse): TransferListRow | null {
  if (typeof raw.id !== 'number' || !isStatus(raw.status) || typeof raw.originId !== 'number' || typeof raw.destinationId !== 'number') return null;
  return {
    id: raw.id,
    status: raw.status,
    priority: toPriority(raw.priority),
    originBranchId: raw.originId,
    originName: raw.originName?.trim() || `Sede ${raw.originId}`,
    destinationBranchId: raw.destinationId,
    destinationName: raw.destinationName?.trim() || `Sede ${raw.destinationId}`,
    firstProductName: raw.firstProductName?.trim() || null,
    productCount: raw.productCount ?? 0,
    freightStatus: toFreightStatus(raw.freightStatus),
    freightBalance: raw.freightBalance ?? 0,
    requestDate: parseDate(raw.requestDate),
    awaitsMe: raw.awaitsMe ?? false,
  };
}

function searchParams(query: TransferQuery): HttpParams {
  let params = new HttpParams()
    .set('page', String(Math.max(0, query.page - 1)))
    .set('size', String(query.size))
    .set('sortBy', query.sortBy)
    .set('direction', query.ascending ? 'asc' : 'desc')
    .set('status', query.status)
    .set('flow', query.flow);
  if (query.priority) params = params.set('priority', query.priority);
  if (query.from) params = params.set('from', toIsoDay(query.from));
  if (query.to) params = params.set('to', toIsoDay(query.to));
  if (query.originId !== null) params = params.set('originId', String(query.originId));
  if (query.destinationId !== null) params = params.set('destinationId', String(query.destinationId));
  if (query.productId !== null) params = params.set('productId', String(query.productId));
  if (query.onlyMine) params = params.set('onlyMine', 'true');
  if (query.text.trim()) params = params.set('q', query.text.trim());
  return params;
}

function requireTransfer(raw: TransferResponse): Transfer {
  const transfer = toTransfer(raw);
  if (!transfer) throw new Error('El servidor devolvió un traslado incompleto.');
  return transfer;
}

@Injectable({ providedIn: 'root' })
export class TransfersApi {
  private readonly http = inject(HttpClient);
  private readonly stock = inject(StockAvailabilityApi);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/transfers`;

  // Las pantallas muestran el error en su propia tabla o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Una página de la lista de traslados (ADMIN: todos; el resto: los de su sucursal, como origen o destino). */
  search(query: TransferQuery): Observable<TransferListPage> {
    return this.http.get<TransferPageResponse>(`${this.url}/search`, { ...this.options, params: searchParams(query) }).pipe(
      map((page) => ({
        transfers: (page.content ?? []).map(toListRow).filter((t): t is TransferListRow => t !== null),
        total: page.totalElements ?? 0,
      })),
    );
  }

  /** Todo lo filtrado, página a página, para exportar (no solo la página que se ve). */
  searchAll(query: TransferQuery): Observable<TransferListRow[]> {
    const pageOf = (page: number) => this.search({ ...query, page, size: EXPORT_PAGE_SIZE }).pipe(map((result) => ({ page, result })));
    return pageOf(1).pipe(
      expand(({ page, result }) =>
        page * EXPORT_PAGE_SIZE < result.total && page < EXPORT_MAX_PAGES && result.transfers.length > 0 ? pageOf(page + 1) : EMPTY,
      ),
      reduce((all, { result }) => [...all, ...result.transfers], [] as TransferListRow[]),
    );
  }

  /** Los totales del encabezado de traslados. */
  summary(): Observable<TransferSummary> {
    return this.http.get<TransferSummaryResponse>(`${this.url}/summary`, this.options).pipe(
      map((s) => ({ open: s.open ?? 0, awaitingMe: s.awaitingMe ?? 0, freightOwed: s.freightOwed ?? 0, freightOwedCount: s.freightOwedCount ?? 0 })),
    );
  }

  /** Un traslado completo, con sus líneas y pagos del flete (al abrir su detalle). */
  get(id: number): Observable<Transfer> {
    return this.http.get<TransferResponse>(`${this.url}/${id}`, this.options).pipe(map(requireTransfer));
  }

  availability(branchId: number): Observable<ReadonlyMap<number, number>> {
    return this.stock.availability(branchId);
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

  /** Registra un pago o abono del flete: queda con pago parcial mientras haya saldo y pagado al cubrir el costo. */
  /** Anula un pago del flete equivocado (queda en el historial, deja de contar en lo pagado). */
  voidFreightPayment(id: number, paymentId: number, reason: string): Observable<Transfer> {
    return this.http.post<TransferResponse>(`${this.url}/${id}/freight-payments/${paymentId}/void`, { reason: reason.trim() }, this.options).pipe(map(requireTransfer));
  }

  payFreight(id: number, input: FreightPaymentInput): Observable<Transfer> {
    const body = {
      ...(input.amount !== null ? { amount: input.amount } : {}),
      method: input.method,
      ...(input.reference.trim() ? { reference: input.reference.trim() } : {}),
      ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
    };
    return this.http.post<TransferResponse>(`${this.url}/${id}/pay-freight`, body, this.options).pipe(map(requireTransfer));
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
