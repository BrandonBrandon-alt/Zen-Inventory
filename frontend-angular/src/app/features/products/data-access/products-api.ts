import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type ProductResponse = components['schemas']['ProductResponse'];
type ProductUnitResponse = components['schemas']['ProductUnitResponse'];

/** Proveedor de un producto, con las condiciones pactadas. */
export interface ProductSupplier {
  readonly supplierId: number;
  readonly nombre: string;
  readonly negotiatedPrice: number;
  readonly deliveryDays: number;
  readonly preferred: boolean;
}

/** Producto con los campos que la app necesita siempre presentes (el OpenAPI los marca todos como opcionales). */
export interface Product {
  readonly id: number;
  readonly sku: string;
  readonly nombre: string;
  /** Lo calcula el sistema con cada compra; no se edita a mano. */
  readonly cost: number;
  readonly price: number;
  readonly unitId: number | null;
  readonly unitAbbreviation: string;
  readonly activo: boolean;
  readonly suppliers: readonly ProductSupplier[];
}

/** Datos editables de un producto. */
export interface ProductInput {
  readonly sku: string;
  readonly nombre: string;
  readonly cost: number;
  readonly price: number;
  readonly unitId: number;
  readonly suppliers: readonly Omit<ProductSupplier, 'nombre'>[];
  /** Solo en edición. */
  readonly activo?: boolean;
}

/** Unidad en la que se puede manejar un producto, con su equivalencia respecto a la unidad base. */
export interface ProductUnit {
  readonly unitId: number;
  readonly nombre: string;
  readonly abreviatura: string;
  readonly factor: number;
  readonly isBase: boolean;
}

function toProduct(raw: ProductResponse): Product | null {
  if (typeof raw.id !== 'number' || !raw.sku?.trim() || !raw.nombre?.trim()) return null;
  return {
    id: raw.id,
    sku: raw.sku.trim(),
    nombre: raw.nombre.trim(),
    cost: raw.costoPromedio ?? 0,
    price: raw.precioVenta ?? 0,
    unitId: raw.unitId ?? null,
    unitAbbreviation: raw.unitAbbreviation?.trim() ?? '',
    activo: raw.activo !== false,
    suppliers: (raw.proveedores ?? []).flatMap((s) =>
      typeof s.id === 'number' && s.nombre
        ? [{ supplierId: s.id, nombre: s.nombre, negotiatedPrice: s.precioPactado ?? 0, deliveryDays: s.tiempoEntregaDias ?? 0, preferred: s.preferido === true }]
        : [],
    ),
  };
}

function requireProduct(raw: ProductResponse): Product {
  const product = toProduct(raw);
  if (!product) throw new Error('El servidor devolvió un producto incompleto.');
  return product;
}

function toRequest(input: ProductInput): components['schemas']['ProductRequest'] {
  return {
    sku: input.sku.trim(),
    nombre: input.nombre.trim(),
    costoPromedio: input.cost,
    precioVenta: input.price,
    unitId: input.unitId,
    suppliers: input.suppliers.map((s) => ({
      supplierId: s.supplierId,
      negotiatedPrice: s.negotiatedPrice,
      deliveryDays: s.deliveryDays,
      preferred: s.preferred,
    })),
    ...(input.activo !== undefined ? { activo: input.activo } : {}),
  };
}

function toProductUnit(raw: ProductUnitResponse): ProductUnit | null {
  if (typeof raw.unidadId !== 'number' || typeof raw.factorConversion !== 'number') return null;
  return {
    unitId: raw.unidadId,
    nombre: raw.nombreUnidad?.trim() ?? '',
    abreviatura: raw.abreviaturaUnidad?.trim() ?? '',
    factor: raw.factorConversion,
    isBase: raw.esBase === true,
  };
}

@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Las pantallas muestran el error en su propia tabla, formulario o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  list(): Observable<Product[]> {
    return this.http
      .get<ProductResponse[]>(`${this.baseUrl}/api/catalog/products`, this.options)
      .pipe(map((items) => items.map(toProduct).filter((product): product is Product => product !== null)));
  }

  create(input: ProductInput): Observable<Product> {
    return this.http.post<ProductResponse>(`${this.baseUrl}/api/catalog/products`, toRequest(input), this.options).pipe(map(requireProduct));
  }

  update(id: number, input: ProductInput): Observable<Product> {
    return this.http.put<ProductResponse>(`${this.baseUrl}/api/catalog/products/${id}`, toRequest(input), this.options).pipe(map(requireProduct));
  }

  /** "Desactivar": el backend no borra el producto, lo marca como inactivo. */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/catalog/products/${id}`, this.options);
  }

  units(productId: number): Observable<ProductUnit[]> {
    return this.http
      .get<ProductUnitResponse[]>(`${this.baseUrl}/api/catalog/products/${productId}/units`, this.options)
      .pipe(map((items) => items.map(toProductUnit).filter((unit): unit is ProductUnit => unit !== null)));
  }

  /** Agrega una unidad alterna: `factor` es cuántas unidades base equivalen a 1 de esta. */
  addUnit(productId: number, unitId: number, factor: number): Observable<ProductUnit> {
    return this.http
      .post<ProductUnitResponse>(
        `${this.baseUrl}/api/catalog/products/${productId}/units`,
        { productoId: productId, unidadId: unitId, factorConversion: factor, esBase: false },
        this.options,
      )
      .pipe(
        map((raw) => {
          const unit = toProductUnit(raw);
          if (!unit) throw new Error('El servidor devolvió una unidad incompleta.');
          return unit;
        }),
      );
  }

  removeUnit(productId: number, unitId: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/catalog/products/${productId}/units/${unitId}`, this.options);
  }
}
