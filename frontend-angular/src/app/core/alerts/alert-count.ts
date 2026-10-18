import { HttpClient, HttpContext } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import { type StockAlertResponse, isShowableAlert } from '@core/alerts/alert-types';
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
  private readonly document = inject(DOCUMENT);

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
        // Con la pestaña oculta nadie ve la insignia: no se consulta; al volver se actualiza de inmediato.
        this.timer = setInterval(() => {
          if (!this.document.hidden) this.refresh();
        }, ALERT_COUNT_INTERVAL);
      } else {
        this.state.set(0);
      }
    });
    const onVisible = () => {
      if (!this.document.hidden) this.refresh();
    };
    this.document.addEventListener('visibilitychange', onVisible);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.document.removeEventListener('visibilitychange', onVisible);
    });
  }

  refresh(): void {
    const role = this.auth.role();
    if (role === null || !ALERT_ROLES.includes(role)) return;
    const id = ++this.requestId;
    this.http
      .get<StockAlertResponse[]>(`${this.baseUrl}/api/v1/alerts`, { context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true) })
      .subscribe({
        next: (items) => {
          if (id === this.requestId && Array.isArray(items)) this.state.set(items.filter(isShowableAlert).length);
        },
        error: () => undefined,
      });
  }

  private stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    // Una respuesta en vuelo de la sesión anterior no debe pintar su número en la siguiente (o tras cerrar sesión).
    this.requestId++;
  }
}
