import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, catchError, map, of } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import type { components } from '@core/api/schema';
import type { AuthSession } from '@core/auth/session/auth-session';

type BranchResponse = components['schemas']['BranchResponse'];

export const GLOBAL_LABEL = 'Gestión Global';
export const DEFAULT_BRANCH_LABEL = 'Zen Inventory';

/** Texto que identifica el ámbito del usuario en la tarjeta del sidebar. Nunca falla: degrada a la etiqueta por defecto. */
@Injectable({ providedIn: 'root' })
export class BranchLabelApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  labelFor(session: AuthSession): Observable<string> {
    if (session.rol === 'ADMIN') return of(GLOBAL_LABEL);
    if (session.sucursalId === undefined) return of(DEFAULT_BRANCH_LABEL);
    return this.http.get<BranchResponse>(`${this.baseUrl}/api/branches/${session.sucursalId}`).pipe(
      map((branch) => branch.nombre?.trim() || DEFAULT_BRANCH_LABEL),
      catchError(() => of(DEFAULT_BRANCH_LABEL)),
    );
  }
}
