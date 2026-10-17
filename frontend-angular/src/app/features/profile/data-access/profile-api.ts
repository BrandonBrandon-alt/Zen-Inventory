import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import type { components } from '@core/api/schema';

type UserResponse = components['schemas']['UserResponse'];

/** Cuenta propia con los campos que la pantalla necesita siempre presentes. */
export interface Profile {
  readonly id: number;
  readonly nombre: string;
  readonly email: string;
  readonly rol: string;
  readonly sucursalId: number | null;
  /** Cuándo cambió la foto; `null` si no tiene. */
  readonly avatarVersion: string | null;
}

/** Tipos de imagen que el servidor acepta y tamaño máximo del archivo (el servidor lo reduce a 256 px). */
export const AVATAR_TYPES: readonly string[] = ['image/jpeg', 'image/png', 'image/gif'];
export const AVATAR_MAX_BYTES = 5 * 1024 * 1024;

function toProfile(raw: UserResponse): Profile {
  if (typeof raw.id !== 'number' || !raw.email) throw new Error('El servidor devolvió un perfil incompleto.');
  return {
    id: raw.id,
    nombre: raw.nombre?.trim() || raw.email,
    email: raw.email.trim(),
    rol: raw.role?.nombre ?? '',
    sucursalId: raw.sucursalId ?? null,
    avatarVersion: raw.avatarActualizadoEn ?? null,
  };
}

@Injectable({ providedIn: 'root' })
export class ProfileApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  // La pantalla muestra ella misma los errores (contraseña actual incorrecta, archivo inválido…).
  private get context() {
    return new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);
  }

  get(): Observable<Profile> {
    return this.http.get<UserResponse>(`${this.baseUrl}/api/profile`, { context: this.context }).pipe(map(toProfile));
  }

  updateName(nombre: string): Observable<Profile> {
    return this.http.put<UserResponse>(`${this.baseUrl}/api/profile`, { nombre }, { context: this.context }).pipe(map(toProfile));
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>(
      `${this.baseUrl}/api/profile/password`,
      { contrasenaActual: currentPassword, contrasenaNueva: newPassword },
      { context: this.context },
    );
  }

  uploadAvatar(file: File): Observable<Profile> {
    const body = new FormData();
    body.append('archivo', file);
    return this.http.put<UserResponse>(`${this.baseUrl}/api/profile/avatar`, body, { context: this.context }).pipe(map(toProfile));
  }

  removeAvatar(): Observable<Profile> {
    return this.http.delete<UserResponse>(`${this.baseUrl}/api/profile/avatar`, { context: this.context }).pipe(map(toProfile));
  }
}
