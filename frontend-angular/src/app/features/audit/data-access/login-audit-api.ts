import { HttpClient, HttpContext, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { type Observable, map } from 'rxjs';
import { API_BASE_URL } from '@core/api/api-base-url';
import { SKIP_ERROR_NOTIFICATION } from '@core/api/error.interceptor';
import { toIsoDay } from '@shared/format/format';
import type { components } from '@core/api/schema';

type LoginEventPageResponse = components['schemas']['LoginEventPageResponse'];
type LoginEventResponse = components['schemas']['LoginEventResponse'];

export const LOGIN_OUTCOMES = ['EXITOSO', 'CREDENCIALES_INVALIDAS', 'CUENTA_DESACTIVADA', 'BLOQUEADO'] as const;
export type LoginOutcome = (typeof LOGIN_OUTCOMES)[number];

/** Un intento de inicio de sesión. `userName` es nulo si el correo no es de ninguna cuenta. */
export interface LoginEvent {
  readonly id: number;
  readonly date: Date;
  readonly email: string;
  readonly userName: string | null;
  readonly outcome: LoginOutcome;
  readonly ip: string;
}

export interface LoginEventQuery {
  /** Desde 1, como en la tabla. */
  readonly page: number;
  readonly size: number;
  readonly from: Date | null;
  readonly to: Date | null;
  readonly outcome: LoginOutcome | null;
  readonly text: string;
}

export interface LoginEventPage {
  readonly events: LoginEvent[];
  readonly total: number;
  /** Intentos fallidos en todo lo filtrado. */
  readonly failures: number;
}

const isOutcome = (value: unknown): value is LoginOutcome => (LOGIN_OUTCOMES as readonly unknown[]).includes(value);
function toEvent(raw: LoginEventResponse): LoginEvent | null {
  const date = raw.date ? new Date(raw.date) : null;
  if (typeof raw.id !== 'number' || !date || Number.isNaN(date.getTime()) || !isOutcome(raw.outcome)) return null;
  return { id: raw.id, date, email: raw.email?.trim() ?? '', userName: raw.userName?.trim() || null, outcome: raw.outcome, ip: raw.ip?.trim() ?? '' };
}

/** Auditoría de inicios de sesión (solo ADMIN). */
@Injectable({ providedIn: 'root' })
export class LoginAuditApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly context = new HttpContext().set(SKIP_ERROR_NOTIFICATION, true);

  search(query: LoginEventQuery): Observable<LoginEventPage> {
    let params = new HttpParams().set('page', String(Math.max(0, query.page - 1))).set('size', String(query.size));
    if (query.from) params = params.set('from', toIsoDay(query.from));
    if (query.to) params = params.set('to', toIsoDay(query.to));
    if (query.outcome) params = params.set('outcome', query.outcome);
    if (query.text.trim()) params = params.set('q', query.text.trim());
    return this.http.get<LoginEventPageResponse>(`${this.baseUrl}/api/v1/audit/logins`, { params, context: this.context }).pipe(
      map((page) => ({
        events: (page.content ?? []).map(toEvent).filter((e): e is LoginEvent => e !== null),
        total: page.totalElements ?? 0,
        failures: page.failures ?? 0,
      })),
    );
  }
}
