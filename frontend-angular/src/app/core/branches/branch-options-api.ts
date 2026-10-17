import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type BranchResponse = components['schemas']['BranchResponse'];

/** Sucursal elegible en un selector (usuarios, inventario…): lo mínimo para identificarla. */
export interface BranchOption {
  readonly id: number;
  readonly nombre: string;
  readonly activa: boolean;
}

/** Lista de sucursales para selectores. La pantalla decide cómo mostrar el error (sin aviso global duplicado). */
@Injectable({ providedIn: 'root' })
export class BranchOptionsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  list(): Observable<BranchOption[]> {
    return this.http
      .get<BranchResponse[]>(`${this.baseUrl}/api/branches`, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .pipe(
        map((items) =>
          items.flatMap((branch) =>
            typeof branch.id === 'number' && branch.nombre?.trim()
              ? [{ id: branch.id, nombre: branch.nombre.trim(), activa: branch.activa !== false }]
              : [],
          ),
        ),
      );
  }
}
