import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type InventoryMovement = components['schemas']['InventoryMovement'];

export const MOVEMENT_REASONS = ['VENTA', 'COMPRA', 'TRASLADO', 'MERMA', 'DEVOLUCION', 'AJUSTE_POSITIVO', 'AJUSTE_NEGATIVO'] as const;
export type MovementReason = (typeof MOVEMENT_REASONS)[number];
export type MovementType = 'INGRESO' | 'RETIRO';

/** Un movimiento de existencias de cualquier sucursal: qué pasó, dónde, quién y con qué documento. */
export interface AuditMovement {
  readonly id: number;
  readonly date: Date;
  readonly type: MovementType;
  readonly reason: MovementReason;
  readonly subReason: string;
  readonly quantity: number;
  /** Existencias de la sucursal después del movimiento. */
  readonly balance: number | null;
  readonly productId: number;
  readonly branchId: number;
  readonly userId: number | null;
  readonly referenceType: string;
  readonly referenceId: number | null;
  readonly observations: string;
}

function toMovement(raw: InventoryMovement): AuditMovement | null {
  if (typeof raw.id !== 'number' || typeof raw.productId !== 'number' || typeof raw.branchId !== 'number' || typeof raw.quantity !== 'number') return null;
  if ((raw.type !== 'INGRESO' && raw.type !== 'RETIRO') || !raw.reason) return null;
  const date = raw.date ? new Date(raw.date) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return {
    id: raw.id,
    date,
    type: raw.type,
    reason: raw.reason,
    subReason: raw.subReason?.trim() ?? '',
    quantity: raw.quantity,
    balance: raw.finalBalance ?? null,
    productId: raw.productId,
    branchId: raw.branchId,
    userId: raw.userId ?? null,
    referenceType: raw.referenceType?.trim() ?? '',
    referenceId: raw.referenceId ?? null,
    observations: raw.observations?.trim() ?? '',
  };
}

@Injectable({ providedIn: 'root' })
export class AuditApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Todos los movimientos de existencias de todas las sucursales (solo el ADMIN los recibe de todas), el más reciente primero. */
  movements(): Observable<AuditMovement[]> {
    return this.http
      .get<InventoryMovement[]>(`${this.baseUrl}/api/v1/inventory/movements`, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .pipe(
        map((items) =>
          items
            .map(toMovement)
            .filter((m): m is AuditMovement => m !== null)
            .sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id),
        ),
      );
  }
}
