import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, forkJoin, map, of } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type SaleResponse = components['schemas']['SaleResponse'];
type ProductResponse = components['schemas']['ProductResponse'];
type InventoryProductResponse = components['schemas']['InventoryProductResponse'];

export const SALE_STATUSES = ['COMPLETED', 'CANCELED', 'RETURNED'] as const;
export type SaleStatus = (typeof SALE_STATUSES)[number];
const isStatus = (value: unknown): value is SaleStatus => (SALE_STATUSES as readonly unknown[]).includes(value);

export interface SaleLine {
  readonly id: number;
  readonly productId: number;
  readonly productName: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly discountPct: number;
  readonly subtotal: number;
}

export interface Sale {
  readonly id: number;
  readonly date: Date | null;
  readonly status: SaleStatus;
  readonly branchId: number;
  readonly branchName: string;
  readonly seller: string;
  readonly customerName: string;
  readonly customerDocument: string;
  readonly subtotal: number;
  readonly discount: number;
  readonly total: number;
  readonly globalDiscountPct: number;
  readonly cancellationReason: string;
  readonly lines: readonly SaleLine[];
}

/** Un producto que se puede vender en el punto de venta, con su existencia en la sucursal. */
export interface PosProduct {
  readonly id: number;
  readonly sku: string;
  readonly name: string;
  readonly unit: string;
  readonly stock: number;
  readonly price: number;
}

export interface PriceListOption {
  readonly id: number;
  readonly name: string;
  readonly description: string;
}

export interface SaleInput {
  /** Sucursal desde la que se vende (la propia; el ADMIN elige). El servidor rechaza una ajena a quien no es ADMIN. */
  readonly branchId: number;
  /** Quien vende: el contrato lo exige aunque el servidor toma al vendedor de la sesión. */
  readonly userId: number;
  readonly customerName: string;
  readonly customerDocument: string;
  readonly globalDiscountPct: number;
  readonly priceListId: number | null;
  readonly items: readonly { productId: number; quantity: number; discountPct: number }[];
}

/** Lista de precios tal como la devuelve el servidor (el OpenAPI no la describe). */
interface RawPriceList {
  id?: number;
  nombre?: string;
  descripcion?: string;
}

interface RawPrice {
  productoId?: number;
  precio?: number;
}

function toSale(raw: SaleResponse): Sale | null {
  if (typeof raw.id !== 'number' || typeof raw.branchId !== 'number' || !isStatus(raw.status)) return null;
  const date = raw.date ? new Date(raw.date) : null;
  return {
    id: raw.id,
    date: date && !Number.isNaN(date.getTime()) ? date : null,
    status: raw.status,
    branchId: raw.branchId,
    branchName: raw.branchName?.trim() ?? '',
    seller: raw.userName?.trim() ?? '',
    customerName: raw.customerName?.trim() ?? '',
    customerDocument: raw.customerDocument?.trim() ?? '',
    subtotal: raw.subtotal ?? 0,
    discount: raw.totalDiscount ?? 0,
    total: raw.totalFinal ?? 0,
    globalDiscountPct: raw.globalDiscountPercentage ?? 0,
    cancellationReason: raw.cancellationReason?.trim() ?? '',
    lines: (raw.details ?? []).flatMap((d) =>
      typeof d.id === 'number' && typeof d.productId === 'number'
        ? [
            {
              id: d.id,
              productId: d.productId,
              productName: d.productName?.trim() || `Producto ${d.productId}`,
              quantity: d.quantity ?? 0,
              unitPrice: d.unitPriceApplied ?? 0,
              discountPct: d.discountPercentage ?? 0,
              subtotal: d.subtotalLine ?? 0,
            },
          ]
        : [],
    ),
  };
}

function requireSale(raw: SaleResponse): Sale {
  const sale = toSale(raw);
  if (!sale) throw new Error('El servidor devolvió una venta incompleta.');
  return sale;
}

@Injectable({ providedIn: 'root' })
export class SalesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Las pantallas muestran el error en su propia tabla o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Productos activos con su existencia y precio en una sucursal; los que no tienen registro aparecen con 0. */
  catalog(branchId: number): Observable<PosProduct[]> {
    return forkJoin({
      products: this.http.get<ProductResponse[]>(`${this.baseUrl}/api/catalog/products`, this.options),
      inventory: this.http.get<InventoryProductResponse[]>(`${this.baseUrl}/api/v1/inventory/branches/${branchId}`, this.options),
    }).pipe(
      map(({ products, inventory }) => {
        const stock = new Map(inventory.filter((row) => typeof row.productId === 'number').map((row) => [row.productId as number, row.stockActual ?? 0]));
        return products
          .flatMap((p): PosProduct[] =>
            typeof p.id === 'number' && p.nombre?.trim() && p.activo !== false
              ? [{ id: p.id, sku: p.sku?.trim() ?? '', name: p.nombre.trim(), unit: p.unitAbbreviation?.trim() ?? '', stock: stock.get(p.id) ?? 0, price: p.precioVenta ?? 0 }]
              : [],
          )
          .sort((a, b) => a.name.localeCompare(b.name, 'es'));
      }),
    );
  }

  /** Listas de precios. El operador de inventario no tiene acceso (403): para él no hay listas, se vende al precio normal. */
  priceLists(): Observable<PriceListOption[]> {
    return this.http.get<RawPriceList[]>(`${this.baseUrl}/api/v1/price-lists`, this.options).pipe(
      map((items) =>
        items.flatMap((l) => (typeof l.id === 'number' && l.nombre?.trim() ? [{ id: l.id, name: l.nombre.trim(), description: l.descripcion?.trim() ?? '' }] : [])),
      ),
      catchError(() => of([])),
    );
  }

  /** Precio de cada producto en una lista (los que no aparecen se venden al precio normal). */
  prices(listId: number): Observable<ReadonlyMap<number, number>> {
    return this.http.get<RawPrice[]>(`${this.baseUrl}/api/v1/price-lists/${listId}/prices`, this.options).pipe(
      map((items) => new Map(items.flatMap((p) => (typeof p.productoId === 'number' && typeof p.precio === 'number' ? [[p.productoId, p.precio] as const] : [])))),
    );
  }

  create(input: SaleInput): Observable<Sale> {
    const customerName = input.customerName.trim();
    const customerDocument = input.customerDocument.trim();
    return this.http
      .post<SaleResponse>(
        `${this.baseUrl}/api/v1/sales`,
        {
          branchId: input.branchId,
          userId: input.userId,
          ...(customerName ? { customerName } : {}),
          ...(customerDocument ? { customerDocument } : {}),
          globalDiscountPercentage: input.globalDiscountPct,
          ...(input.priceListId !== null ? { priceListId: input.priceListId } : {}),
          items: input.items.map((i) => ({ productId: i.productId, quantity: i.quantity, discountPercentage: i.discountPct })),
        },
        this.options,
      )
      .pipe(map(requireSale));
  }

  /** Ventas visibles para quien consulta (ADMIN: todas o las de una sucursal; el resto: las de la suya), la más reciente primero. */
  list(branchId: number | null): Observable<Sale[]> {
    return this.http
      .get<SaleResponse[]>(`${this.baseUrl}/api/v1/sales`, { ...this.options, ...(branchId !== null ? { params: { branchId } } : {}) })
      .pipe(
        map((items) =>
          items
            .map(toSale)
            .filter((s): s is Sale => s !== null)
            .sort((a, b) => b.id - a.id),
        ),
      );
  }

  /** Anula la venta y devuelve el stock a la sucursal (ADMIN y MANAGER). */
  cancel(id: number, reason: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/v1/sales/${id}`, { ...this.options, params: { reason: reason.trim() } });
  }
}
