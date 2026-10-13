import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../api/api-base-url';
import type { components } from '../../api/schema';
import { type AuthSession, isAuthSession } from '../session/auth-session';
import { AuthStore } from '../session/auth-store';
import { LOGIN_ENDPOINT } from '../auth-urls';

type LoginRequest = components['schemas']['LoginRequest'];
type LoginResponse = components['schemas']['LoginResponse'];

export type AuthErrorKind = 'credentials' | 'network' | 'server' | 'invalid-response';

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const DEFAULT_CREDENTIALS_MESSAGE = 'Credenciales incorrectas. Inténtalo de nuevo.';
const NETWORK_MESSAGE = 'No se pudo conectar con el servidor.';
const SERVER_MESSAGE = 'El servidor no pudo procesar la solicitud. Inténtalo más tarde.';

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly store = inject(AuthStore);

  /** Inicia sesión: en éxito guarda y devuelve la sesión; en fallo lanza un AuthError. */
  async login(credentials: LoginRequest): Promise<AuthSession> {
    let response: LoginResponse;
    try {
      response = await firstValueFrom(
        this.http.post<LoginResponse>(`${this.baseUrl}${LOGIN_ENDPOINT}`, credentials),
      );
    } catch (error) {
      throw this.toAuthError(error);
    }

    // El OpenAPI marca todos los campos como opcionales: se valida antes de aceptar la sesión.
    const session = {
      token: response.token,
      email: response.email,
      nombre: response.nombre ?? '',
      rol: response.rol ?? '',
      id: response.id,
      sucursalId: response.sucursalId,
    };
    if (!isAuthSession(session)) {
      throw new AuthError('invalid-response', 'El servidor devolvió una respuesta de sesión incompleta.');
    }
    this.store.start(session);
    return session;
  }

  private toAuthError(error: unknown): AuthError {
    if (!(error instanceof HttpErrorResponse) || error.status === 0) {
      return new AuthError('network', NETWORK_MESSAGE);
    }
    if (error.status >= 500) return new AuthError('server', SERVER_MESSAGE);
    return new AuthError('credentials', this.backendMessage(error.error) ?? DEFAULT_CREDENTIALS_MESSAGE);
  }

  private backendMessage(body: unknown): string | null {
    if (typeof body !== 'object' || body === null) return null;
    const message = (body as { message?: unknown }).message;
    return typeof message === 'string' && message.length > 0 ? message : null;
  }
}
