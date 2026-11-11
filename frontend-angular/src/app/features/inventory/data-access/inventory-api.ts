import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, forkJoin, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';
import { AuthStore } from '@core/auth/session/auth-store';

type ProductResponse = components['schemas']['ProductResponse'];
type InventoryProductResponse = components['schemas']['InventoryProductResponse'];
type InventoryMovementResponse = components['schemas']['InventoryMovement'];

export type MovementType = 'INGRESO' | 'RETIRO';
export type MovementReason = NonNullable<InventoryMovementResponse['reason']>;

/** Un producto con su existencia en una sucursal (cero si todavía no tiene registro de inventario). */
export interface InventoryItem {
  readonly productId: number;
  readonly sku: string;
  readonly nombre: string;
  readonly unit: string;
  readonly stock: number;
  readonly minimum: number;
  /** Precio de venta y costo promedio: dato de margen, solo se muestra a quien corresponde. */
  readonly price: number | null;
  readonly cost: number | null;
}

export type StockLevel = 'out' | 'critical' | 'ok';

/** Agotado (sin existencias), crítico (en o bajo el mínimo definido) o normal. Sin mínimo definido no hay "crítico". */
export function stockLevel(item: Pick<InventoryItem, 'stock' | 'minimum'>): StockLevel {
  if (item.stock <= 0) return 'out';
  if (item.minimum > 0 && item.stock <= item.minimum) return 'critical';
  return 'ok';
}

/** Ajuste manual de existencias. */
export interface AdjustInput {
  readonly type: MovementType;
  readonly quantity: number;
  readonly reason: MovementReason;
  readonly observations: string;
  /** Categoría de la merma (obligatoria cuando el motivo es MERMA). */
  readonly subReason?: string;
  /** Solo en ingresos por ajuste: costo unitario sugerido. */
  readonly unitCost?: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly session = inject(AuthStore).session;

  private get context() {
    // La pantalla muestra el error en su propia tabla o diálogo: sin aviso global duplicado.
    return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
  }

  /** Productos activos con su existencia en la sucursal: los que aún no tienen registro aparecen con 0. */
  list(branchId: number): Observable<InventoryItem[]> {
    return forkJoin({
      products: this.http.get<ProductResponse[]>(`${this.baseUrl}/api/catalog/products`, { context: this.context }),
      inventory: this.http.get<InventoryProductResponse[]>(`${this.baseUrl}/api/v1/inventory/branches/${branchId}`, { context: this.context }),
    }).pipe(
      map(({ products, inventory }) => {
        const byProduct = new Map(inventory.filter((row) => typeof row.productId === 'number').map((row) => [row.productId as number, row]));
        return products.flatMap((product): InventoryItem[] => {
          if (typeof product.id !== 'number' || !product.nombre?.trim() || product.activo === false) return [];
          const row = byProduct.get(product.id);
          return [
            {
              productId: product.id,
              sku: product.sku?.trim() ?? '',
              nombre: product.nombre.trim(),
              unit: product.unitAbbreviation?.trim() || row?.unit?.trim() || '',
              stock: row?.stockActual ?? 0,
              minimum: row?.stockMinimo ?? 0,
              price: product.precioVenta ?? row?.precioVenta ?? null,
              cost: product.costoPromedio ?? row?.costoPromedio ?? null,
            },
          ];
        });
      }),
    );
  }

  adjust(branchId: number, productId: number, input: AdjustInput): Observable<void> {
    const action = input.type === 'INGRESO' ? 'add' : 'withdraw';
    const body: components['schemas']['StockRequest'] = {
      quantity: input.quantity,
      reason: input.reason,
      // El servidor ignora este campo (la autoría es la de la sesión); el contrato aún lo marca como obligatorio.
      userId: this.session()?.id ?? 0,
      observations: input.observations.trim(),
      ...(input.subReason ? { subReason: input.subReason } : {}),
      ...(input.unitCost !== undefined && input.type === 'INGRESO' ? { unitCost: input.unitCost } : {}),
    };
    return this.http.post<void>(`${this.baseUrl}/api/v1/inventory/branches/${branchId}/products/${productId}/${action}`, body, { context: this.context });
  }

  setMinimum(branchId: number, productId: number, minimum: number): Observable<void> {
    return this.http
      .put<unknown>(`${this.baseUrl}/api/v1/inventory/branches/${branchId}/products/${productId}/config`, null, {
        params: new HttpParams().set('minimumStock', minimum),
        context: this.context,
      })
      .pipe(map(() => undefined));
  }
}
