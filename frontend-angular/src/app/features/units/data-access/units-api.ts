import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type UnitResponse = components['schemas']['UnitOfMeasureResponse'];

/** Unidad de medida con los campos que la app necesita siempre presentes. */
export interface Unit {
  readonly id: number;
  readonly nombre: string;
  readonly abreviatura: string;
}

/** Datos editables de una unidad. */
export interface UnitInput {
  readonly nombre: string;
  readonly abreviatura: string;
}

function toUnit(raw: UnitResponse): Unit | null {
  if (typeof raw.id !== 'number' || !raw.nombre?.trim() || !raw.abreviatura?.trim()) return null;
  return { id: raw.id, nombre: raw.nombre.trim(), abreviatura: raw.abreviatura.trim() };
}

function requireUnit(raw: UnitResponse): Unit {
  const unit = toUnit(raw);
  if (!unit) throw new Error('El servidor devolvió una unidad incompleta.');
  return unit;
}

const toRequest = (input: UnitInput): components['schemas']['UnitOfMeasureRequest'] => ({
  nombre: input.nombre.trim(),
  abreviatura: input.abreviatura.trim(),
});

@Injectable({ providedIn: 'root' })
export class UnitsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // Las pantallas muestran el error en su propia tabla, formulario o diálogo: sin aviso global duplicado.
  private get options() {
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  list(): Observable<Unit[]> {
    return this.http
      .get<UnitResponse[]>(`${this.baseUrl}/api/catalog/units`, this.options)
      .pipe(map((items) => items.map(toUnit).filter((unit): unit is Unit => unit !== null)));
  }

  create(input: UnitInput): Observable<Unit> {
    return this.http.post<UnitResponse>(`${this.baseUrl}/api/catalog/units`, toRequest(input), this.options).pipe(map(requireUnit));
  }

  update(id: number, input: UnitInput): Observable<Unit> {
    return this.http.put<UnitResponse>(`${this.baseUrl}/api/catalog/units/${id}`, toRequest(input), this.options).pipe(map(requireUnit));
  }

  /** Borra la unidad; el servidor responde 409 si algún producto la usa. */
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/catalog/units/${id}`, this.options);
  }
}
