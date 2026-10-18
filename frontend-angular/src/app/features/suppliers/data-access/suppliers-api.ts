import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type SupplierResponse = components['schemas']['SupplierResponse'];

/** Proveedor con los campos que la app necesita siempre presentes. */
export interface Supplier {
  readonly id: number;
  readonly nombre: string;
  readonly contacto: string;
  /** Días que tarda en entregar; `null` si no se indicó. */
  readonly tiempoEntregaDias: number | null;
}

/** Datos editables de un proveedor. */
export interface SupplierInput {
  readonly nombre: string;
  readonly contacto: string;
  /** `null` = sin dato. */
  readonly tiempoEntregaDias: number | null;
}

function toSupplier(raw: SupplierResponse): Supplier | null {
  if (typeof raw.id !== 'number' || !raw.nombre?.trim()) return null;
  return {
    id: raw.id,
    nombre: raw.nombre.trim(),
    contacto: raw.contacto?.trim() ?? '',
    tiempoEntregaDias: raw.tiempoEntregaDias ?? null,
  };
}

function requireSupplier(raw: SupplierResponse): Supplier {
  const supplier = toSupplier(raw);
  if (!supplier) throw new Error('El servidor devolvió un proveedor incompleto.');
  return supplier;
}

function toRequest(input: SupplierInput): components['schemas']['SupplierRequest'] {
  const contacto = input.contacto.trim();
  return {
    nombre: input.nombre.trim(),
    ...(contacto ? { contacto } : {}),
    ...(input.tiempoEntregaDias !== null ? { tiempoEntregaDias: input.tiempoEntregaDias } : {}),
  };
}

@Injectable({ providedIn: 'root' })
export class SuppliersApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Las pantallas muestran el error en su propia tabla, formulario o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  list(): Observable<Supplier[]> {
    return this.http
      .get<SupplierResponse[]>(`${this.baseUrl}/api/catalog/suppliers`, this.options)
      .pipe(map((items) => items.map(toSupplier).filter((supplier): supplier is Supplier => supplier !== null)));
  }

  create(input: SupplierInput): Observable<Supplier> {
    return this.http.post<SupplierResponse>(`${this.baseUrl}/api/catalog/suppliers`, toRequest(input), this.options).pipe(map(requireSupplier));
  }

  update(id: number, input: SupplierInput): Observable<Supplier> {
    return this.http.put<SupplierResponse>(`${this.baseUrl}/api/catalog/suppliers/${id}`, toRequest(input), this.options).pipe(map(requireSupplier));
  }

  /** Borra el proveedor; el servidor responde 409 si todavía tiene productos o compras asociadas. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/catalog/suppliers/${id}`, this.options);
  }
}
