import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type UnitResponse = components['schemas']['UnitOfMeasureResponse'];
type SupplierResponse = components['schemas']['SupplierResponse'];
type ProductResponse = components['schemas']['ProductResponse'];

/** Unidad elegible en un selector: lo mínimo para identificarla. */
export interface UnitOption {
  readonly id: number;
  readonly nombre: string;
  readonly abreviatura: string;
}

/** Producto elegible o a nombrar en una lista: lo mínimo para identificarlo. */
export interface ProductOption {
  readonly id: number;
  readonly nombre: string;
  readonly sku: string;
}

/** Proveedor elegible en un selector. */
export interface SupplierOption {
  readonly id: number;
  readonly nombre: string;
  /** Días de entrega habituales; sirve para proponer un valor al asociarlo a un producto. */
  readonly tiempoEntregaDias: number | null;
}

/** Listas del catálogo para selectores. La pantalla decide cómo mostrar el error (sin aviso global duplicado). */
@Injectable({ providedIn: 'root' })
export class CatalogOptionsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private get context() {
    return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
  }

  units(): Observable<UnitOption[]> {
    return this.http.get<UnitResponse[]>(`${this.baseUrl}/api/catalog/units`, { context: this.context }).pipe(
      map((items) =>
        items.flatMap((unit) =>
          typeof unit.id === 'number' && unit.nombre?.trim() && unit.abreviatura?.trim()
            ? [{ id: unit.id, nombre: unit.nombre.trim(), abreviatura: unit.abreviatura.trim() }]
            : [],
        ),
      ),
    );
  }

  suppliers(): Observable<SupplierOption[]> {
    return this.http.get<SupplierResponse[]>(`${this.baseUrl}/api/catalog/suppliers`, { context: this.context }).pipe(
      map((items) =>
        items.flatMap((supplier) =>
          typeof supplier.id === 'number' && supplier.nombre?.trim()
            ? [{ id: supplier.id, nombre: supplier.nombre.trim(), tiempoEntregaDias: supplier.tiempoEntregaDias ?? null }]
            : [],
        ),
      ),
    );
  }

  /** Todos los productos (activos e inactivos): sirve para ponerle nombre a lo que otras pantallas solo referencian por id. */
  products(): Observable<ProductOption[]> {
    return this.http.get<ProductResponse[]>(`${this.baseUrl}/api/catalog/products`, { context: this.context }).pipe(
      map((items) =>
        items.flatMap((product) =>
          typeof product.id === 'number' && product.nombre?.trim()
            ? [{ id: product.id, nombre: product.nombre.trim(), sku: product.sku?.trim() ?? '' }]
            : [],
        ),
      ),
    );
  }

  /** Proveedores que venden un producto. */
  suppliersOf(productId: number): Observable<SupplierOption[]> {
    return this.http
      .get<SupplierResponse[]>(`${this.baseUrl}/api/catalog/suppliers/search`, { params: { productId }, context: this.context })
      .pipe(
        map((items) =>
          items.flatMap((supplier) =>
            typeof supplier.id === 'number' && supplier.nombre?.trim()
              ? [{ id: supplier.id, nombre: supplier.nombre.trim(), tiempoEntregaDias: supplier.tiempoEntregaDias ?? null }]
              : [],
          ),
        ),
      );
  }
}
