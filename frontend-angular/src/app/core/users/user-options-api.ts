import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type UserResponse = components['schemas']['UserResponse'];

/** Persona del sistema para ponerle nombre a lo que otras pantallas solo referencian por id (quién hizo un movimiento…). */
export interface UserName {
  readonly id: number;
  readonly nombre: string;
}

/** Nombres de usuario por id. Quien no administra usuarios (403) no la puede pedir: la pantalla muestra el id. */
@Injectable({ providedIn: 'root' })
export class UserOptionsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  names(): Observable<UserName[]> {
    return this.http
      .get<UserResponse[]>(`${this.baseUrl}/api/users`, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .pipe(
        map((users) =>
          users.flatMap((user) => (typeof user.id === 'number' ? [{ id: user.id, nombre: user.nombre?.trim() || user.email?.trim() || `Usuario ${user.id}` }] : [])),
        ),
      );
  }
}
