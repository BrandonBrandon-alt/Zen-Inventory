import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { parseDate } from '@shared/format/format';

type PurchaseResponse = components['schemas']['PurchaseResponse'];
type PurchaseReceiptResponse = components['schemas']['PurchaseReceiptResponse'];

export const RECEPTION_STATUSES = ['AWAITING_APPROVAL', 'PENDING', 'IN_TRANSIT', 'RECEIVED_PARTIAL', 'RECEIVED_TOTAL', 'CANCELLED'] as const;
export type ReceptionStatus = (typeof RECEPTION_STATUSES)[number];
export const PAYMENT_STATUSES = ['POR_PAGAR', 'PAGO_PARCIAL', 'PAGADO'] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_METHODS = ['EFECTIVO', 'TRANSFERENCIA', 'CHEQUE', 'TARJETA', 'OTRO'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
const isMethod = (value: unknown): value is PaymentMethod => (PAYMENT_METHODS as readonly unknown[]).includes(value);

const isReception = (value: unknown): value is ReceptionStatus => (RECEPTION_STATUSES as readonly unknown[]).includes(value);
const isPayment = (value: unknown): value is PaymentStatus => (PAYMENT_STATUSES as readonly unknown[]).includes(value);

export interface PurchaseLine {
  readonly id: number;
  readonly productId: number;
  readonly quantity: number;
  /** Lo ya recibido en recepciones anteriores; lo que falta es `quantity - received`. */
  readonly received: number;
  readonly unitPrice: number;
  readonly discountPct: number;
  readonly subtotal: number;
}

/** Un pago o abono hecho al proveedor. */
export interface PurchasePayment {
  readonly id: number;
  readonly amount: number;
  readonly date: Date | null;
  readonly userName: string;
  readonly method: PaymentMethod;
  readonly reference: string;
  readonly notes: string;
}

/** Lo que se envía para registrar un pago; sin `amount` se paga todo el saldo. */
export interface PaymentInput {
  readonly amount: number | null;
  readonly method: PaymentMethod;
  readonly reference: string;
  readonly notes: string;
}

export interface Purchase {
  readonly id: number;
  readonly reception: ReceptionStatus;
  readonly payment: PaymentStatus;
  readonly supplierId: number;
  readonly branchId: number;
  readonly requestDate: Date | null;
  readonly estimatedArrival: Date | null;
  readonly actualArrival: Date | null;
  readonly paymentDueDays: number;
  readonly paymentDueDate: Date | null;
  readonly total: number;
  /** Lo ya pagado al proveedor. */
  readonly paid: number;
  /** Lo que aún se le debe; cero si está pagada o cancelada. */
  readonly balance: number;
  /** Queda saldo y ya venció el plazo de pago. */
  readonly overdue: boolean;
  readonly payments: readonly PurchasePayment[];
  readonly reason: string;
  readonly lines: readonly PurchaseLine[];
}

export interface PurchaseInput {
  readonly supplierId: number;
  /** Solo el ADMIN elige la sucursal; para el resto el servidor usa la suya. */
  readonly branchId: number | null;
  readonly leadTimeDays: number;
  readonly paymentDueDays: number;
  readonly items: readonly { productId: number; quantity: number; unitPrice: number; discountPct: number }[];
}

/** Cómo cambió el costo promedio de cada producto al recibir la mercancía. */
export interface CostImpact {
  readonly productId: number;
  readonly productName: string;
  readonly oldCost: number;
  readonly newCost: number;
  readonly received: number;
}

export interface Receipt {
  readonly orderId: number;
  readonly reception: ReceptionStatus;
  readonly impacts: readonly CostImpact[];
}

function toPurchase(raw: PurchaseResponse): Purchase | null {
  if (typeof raw.id !== 'number' || typeof raw.supplierId !== 'number' || typeof raw.branchId !== 'number') return null;
  if (!isReception(raw.receptionStatus)) return null;
  return {
    id: raw.id,
    reception: raw.receptionStatus,
    payment: isPayment(raw.paymentStatus) ? raw.paymentStatus : 'POR_PAGAR',
    supplierId: raw.supplierId,
    branchId: raw.branchId,
    requestDate: parseDate(raw.requestDate),
    estimatedArrival: parseDate(raw.estimatedArrivalDate),
    actualArrival: parseDate(raw.actualArrivalDate),
    paymentDueDays: raw.paymentDueDays ?? 0,
    paymentDueDate: parseDate(raw.paymentDueDate),
    total: raw.total ?? 0,
    paid: raw.paidAmount ?? 0,
    balance: raw.balance ?? 0,
    overdue: raw.overdue ?? false,
    payments: (raw.payments ?? []).flatMap((p) =>
      typeof p.id === 'number'
        ? [{ id: p.id, amount: p.amount ?? 0, date: parseDate(p.date), userName: p.userName?.trim() || 'Desconocido', method: isMethod(p.method) ? p.method : 'OTRO', reference: p.reference?.trim() ?? '', notes: p.notes?.trim() ?? '' }]
        : [],
    ),
    reason: raw.reasonResolution?.trim() ?? '',
    lines: (raw.details ?? []).flatMap((d) =>
      typeof d.id === 'number' && typeof d.productId === 'number'
        ? [{ id: d.id, productId: d.productId, quantity: d.quantity ?? 0, received: d.receivedQuantity ?? 0, unitPrice: d.unitPrice ?? 0, discountPct: d.discountPct ?? 0, subtotal: d.subtotal ?? 0 }]
        : [],
    ),
  };
}

function requirePurchase(raw: PurchaseResponse): Purchase {
  const purchase = toPurchase(raw);
  if (!purchase) throw new Error('El servidor devolvió una orden de compra incompleta.');
  return purchase;
}

@Injectable({ providedIn: 'root' })
export class PurchasesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly url = `${this.baseUrl}/api/v1/purchases`;

  // Las pantallas muestran el error en su propia tabla o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Órdenes visibles para quien consulta (ADMIN: todas; el resto: las de su sucursal), la más reciente primero. */
  list(): Observable<Purchase[]> {
    return this.http.get<PurchaseResponse[]>(this.url, this.options).pipe(
      map((items) =>
        items
          .map(toPurchase)
          .filter((p): p is Purchase => p !== null)
          .sort((a, b) => b.id - a.id),
      ),
    );
  }

  create(input: PurchaseInput): Observable<Purchase> {
    return this.http
      .post<PurchaseResponse>(
        this.url,
        {
          supplierId: input.supplierId,
          ...(input.branchId !== null ? { branchId: input.branchId } : {}),
          leadTimeDays: input.leadTimeDays,
          paymentDueDays: input.paymentDueDays,
          items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountPct: i.discountPct })),
        },
        this.options,
      )
      .pipe(map(requirePurchase));
  }

  approve(id: number): Observable<Purchase> {
    return this.http.post<PurchaseResponse>(`${this.url}/${id}/approve`, {}, this.options).pipe(map(requirePurchase));
  }

  /** La orden sale del proveedor: pasa a "en camino". */
  dispatch(id: number): Observable<Purchase> {
    return this.http.post<PurchaseResponse>(`${this.url}/${id}/dispatch`, {}, this.options).pipe(map(requirePurchase));
  }

  /** Registra lo recibido (en la unidad base de cada producto) y devuelve cómo cambió el costo promedio. */
  receive(id: number, items: readonly { detailId: number; received: number }[]): Observable<Receipt> {
    return this.http
      .post<PurchaseReceiptResponse>(
        `${this.url}/${id}/receive`,
        { items: items.map((i) => ({ detailId: i.detailId, quantityReceived: i.received })) },
        this.options,
      )
      .pipe(
        map((raw) => {
          if (typeof raw.orderId !== 'number' || !isReception(raw.status)) throw new Error('El servidor devolvió una recepción incompleta.');
          return {
            orderId: raw.orderId,
            reception: raw.status,
            impacts: (raw.impacts ?? []).flatMap((i) =>
              typeof i.productId === 'number'
                ? [{ productId: i.productId, productName: i.productName?.trim() || `Producto ${i.productId}`, oldCost: i.oldCpp ?? 0, newCost: i.newCpp ?? 0, received: i.quantityReceived ?? 0 }]
                : [],
            ),
          };
        }),
      );
  }

  /** Registra un pago o abono: la orden queda con pago parcial mientras haya saldo y pagada al cubrir el total. */
  pay(id: number, input: PaymentInput): Observable<Purchase> {
    const body = {
      ...(input.amount !== null ? { amount: input.amount } : {}),
      method: input.method,
      ...(input.reference.trim() ? { reference: input.reference.trim() } : {}),
      ...(input.notes.trim() ? { notes: input.notes.trim() } : {}),
    };
    return this.http.post<PurchaseResponse>(`${this.url}/${id}/pay`, body, this.options).pipe(map(requirePurchase));
  }

  cancel(id: number, reason: string): Observable<void> {
    return this.http.post<void>(`${this.url}/${id}/cancel`, { reason: reason.trim() }, this.options);
  }

  /** Solo ADMIN: da por completa una orden recibida parcialmente, aceptando el faltante. */
  closeShortfall(id: number): Observable<Purchase> {
    return this.http.post<PurchaseResponse>(`${this.url}/${id}/close-shortfall`, {}, this.options).pipe(map(requirePurchase));
  }
}
