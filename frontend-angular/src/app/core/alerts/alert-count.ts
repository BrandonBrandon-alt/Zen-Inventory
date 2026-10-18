import { HttpClient, HttpContext } from '@angular/common/http';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import { AuthStore } from '@core/auth/session/auth-store';
import type { Role } from '@core/auth/roles/role';

/** Quienes pueden consultar las alertas (el backend responde 403 al resto). */
export const ALERT_ROLES: readonly Role[] = ['ADMIN', 'MANAGER', 'OPERADOR_INVENTARIO'];

/** Cada cuánto se vuelve a preguntar cuántas alertas hay (ms). */
export const ALERT_COUNT_INTERVAL = 60_000;

/**
 * Cuántas alertas activas tiene quien está en sesión (el ADMIN, las de todas las sucursales; el resto, las de la suya).
 * Alimenta la insignia del menú. Se actualiza solo cada minuto y cuando una pantalla avisa con `refresh()` (al resolver
 * una alerta o revisar el stock). Si falla, la insignia simplemente no cambia: no es motivo para avisar al usuario.
 */
@Injectable({ providedIn: 'root' })
export class AlertCount {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly auth = inject(AuthStore);

  private readonly state = signal(0);
  /** Alertas activas; 0 si no hay o todavía no se sabe. */
  readonly count = this.state.asReadonly();

  private timer: ReturnType<typeof setInterval> | null = null;
  private requestId = 0;

  constructor() {
    effect(() => {
      const role = this.auth.role();
      this.stop();
      if (role !== null && ALERT_ROLES.includes(role)) {
        this.refresh();
        this.timer = setInterval(() => this.refresh(), ALERT_COUNT_INTERVAL);
      } else {
        this.state.set(0);
      }
    });
    inject(DestroyRef).onDestroy(() => this.stop());
  }

  refresh(): void {
    const role = this.auth.role();
    if (role === null || !ALERT_ROLES.includes(role)) return;
    const id = ++this.requestId;
    this.http
      .get<unknown[]>(`${this.baseUrl}/api/v1/alerts`, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .subscribe({
        next: (items) => {
          if (id === this.requestId && Array.isArray(items)) this.state.set(items.length);
        },
        error: () => undefined,
      });
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}
