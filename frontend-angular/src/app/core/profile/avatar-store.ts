import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, type Signal, effect, inject, signal } from '@angular/core';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import { AuthStore } from '@core/auth/session/auth-store';

interface Entry {
  readonly version: string;
  readonly url: ReturnType<typeof signal<string | null>>;
}

/**
 * Fotos de perfil ya descargadas. La API las protege con el token de sesión, así que no se pueden poner directo en
 * un `<img src>`: se descargan con `HttpClient` y se muestran desde una URL local (`blob:`).
 *
 * Se guarda una foto por usuario y versión; al cambiar la versión se descarga la nueva y se libera la anterior.
 */
@Injectable({ providedIn: 'root' })
export class AvatarStore {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly entries = new Map<number, Entry>();

  constructor() {
    // Al cerrar sesión no queda ninguna foto en memoria: la siguiente persona en ese navegador no las ve.
    const auth = inject(AuthStore);
    effect(() => {
      if (!auth.isAuthenticated()) this.clear();
    });
  }

  /** URL local de la foto del usuario en esa versión; `null` mientras llega o si no se pudo cargar. */
  urlFor(userId: number, version: string): Signal<string | null> {
    const existing = this.entries.get(userId);
    if (existing?.version === version) return existing.url;
    this.release(existing);

    const entry: Entry = { version, url: signal<string | null>(null) };
    this.entries.set(userId, entry);
    this.http
      .get(`${this.baseUrl}/api/avatars/${userId}`, {
        params: { v: version },
        responseType: 'blob',
        context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
      })
      .subscribe({
        next: (blob) => {
          // Si mientras tanto llegó otra versión, esta ya no sirve.
          if (this.entries.get(userId) === entry) entry.url.set(URL.createObjectURL(blob));
        },
        // Sin foto o sin red: se quedan las iniciales; no es motivo de avisar al usuario.
        error: () => undefined,
      });
    return entry.url;
  }

  /** Libera las URLs locales (al cerrar sesión). */
  clear(): void {
    this.entries.forEach((entry) => this.release(entry));
    this.entries.clear();
  }

  private release(entry: Entry | undefined): void {
    const url = entry?.url();
    if (url) URL.revokeObjectURL(url);
  }
}
