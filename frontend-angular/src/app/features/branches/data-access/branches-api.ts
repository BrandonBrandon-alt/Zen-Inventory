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

@Injectable({ providedIn: 'root' })
export class BranchesApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Lista todas las sucursales. La pantalla muestra el error en la propia tabla (sin aviso global duplicado). */
  list(): Observable<Branch[]> {
    return this.http
      .get<BranchResponse[]>(`${this.baseUrl}/api/branches`, {
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .pipe(map((items) => items.map(toBranch).filter((branch): branch is Branch => branch !== null)));
  }
}
