import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type BranchResponse = components['schemas']['BranchResponse'];

/** Sucursal con los campos que la app necesita siempre presentes (el OpenAPI los marca todos como opcionales). */
export interface Branch {
  readonly id: number;
  readonly nombre: string;
  readonly direccion: string;
  readonly telefono: string;
  readonly activa: boolean;
  readonly managerId: number | null;
}

function toBranch(raw: BranchResponse): Branch | null {
  // Sin id o sin nombre no se puede identificar ni mostrar la fila: se descarta.
  if (typeof raw.id !== 'number' || typeof raw.nombre !== 'string' || raw.nombre.trim() === '') return null;
  return {
    id: raw.id,
    nombre: raw.nombre.trim(),
    direccion: raw.direccion?.trim() ?? '',
    telefono: raw.telefono?.trim() ?? '',
    activa: raw.activa !== false,
    managerId: raw.managerId ?? null,
  };
}

/** Datos editables de una sucursal. */
export interface BranchInput {
  readonly nombre: string;
  readonly direccion: string;
  /** Opcional: vacío se envía como ausente. */
  readonly telefono: string;
}

function toRequest(input: BranchInput): components['schemas']['BranchRequest'] {
  const telefono = input.telefono.trim();
  return {
    nombre: input.nombre.trim(),
    direccion: input.direccion.trim(),
    ...(telefono ? { telefono } : {}),
  };
}

function requireBranch(raw: BranchResponse): Branch {
  const branch = toBranch(raw);
  if (!branch) throw new Error('El servidor devolvió una sucursal incompleta.');
  return branch;
}

@Injectable({ providedIn: 'root' })
export class BranchesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  private get options() {
    // Las pantallas muestran el error en su propio formulario o diálogo: sin aviso global duplicado.
    return { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) };
  }

  /** Lista todas las sucursales. La pantalla muestra el error en la propia tabla (sin aviso global duplicado). */
  list(): Observable<Branch[]> {
    return this.http
      .get<BranchResponse[]>(`${this.baseUrl}/api/branches`, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(map((items) => items.map(toBranch).filter((branch): branch is Branch => branch !== null)));
  }

  create(input: BranchInput): Observable<Branch> {
    return this.http
      .post<BranchResponse>(`${this.baseUrl}/api/branches`, toRequest(input), this.options)
      .pipe(map(requireBranch));
  }

  update(id: number, input: BranchInput): Observable<Branch> {
    return this.http
      .put<BranchResponse>(`${this.baseUrl}/api/branches/${id}`, toRequest(input), this.options)
      .pipe(map(requireBranch));
  }

  /** "Desactivar": el backend no borra la sucursal, la marca como inactiva. */
  deactivate(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/api/branches/${id}`, this.options);
  }
}
