import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type UnitResponse = components['schemas']['UnitOfMeasureResponse'];
type SupplierResponse = components['schemas']['SupplierResponse'];

/** Unidad elegible en un selector: lo mínimo para identificarla. */
export interface UnitOption {
  readonly id: number;
  readonly nombre: string;
  readonly abreviatura: string;
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
}
