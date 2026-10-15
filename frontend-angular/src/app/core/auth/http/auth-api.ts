import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../../api/api-base-url';
import { type ApiError, toApiError } from '../../api/api-error';
import { SKIP_ERROR_NOTIFICATION } from '../../api/error.interceptor';
import type { components } from '../../api/schema';
import { type AuthSession, isAuthSession } from '../session/auth-session';
import { AuthStore } from '../session/auth-store';
import { LOGIN_ENDPOINT } from '../auth-urls';

type LoginRequest = components['schemas']['LoginRequest'];
type LoginResponse = components['schemas']['LoginResponse'];

export type AuthErrorKind = 'credentials' | 'disabled' | 'validation' | 'network' | 'server' | 'invalid-response';

export class AuthError extends Error {
  constructor(
    readonly kind: AuthErrorKind,
    message: string,
    /** Errores por campo cuando `kind` es 'validation' (el backend rechazó el formato de algún dato). */
    readonly fieldErrors: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

const DEFAULT_CREDENTIALS_MESSAGE = 'Credenciales incorrectas. Inténtalo de nuevo.';

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
        this.http.post<LoginResponse>(`${this.baseUrl}${LOGIN_ENDPOINT}`, credentials, {
          // El login muestra el error en su propio formulario: sin aviso global duplicado.
          context: new HttpContext().set(SKIP_ERROR_NOTIFICATION, true),
        }),
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
    const api = toApiError(error);
    switch (api.code) {
      case 'NETWORK_ERROR':
      case 'SERVER_UNAVAILABLE':
        return new AuthError('network', api.message);
      case 'ACCOUNT_DISABLED':
        return new AuthError('disabled', api.message);
      case 'VALIDATION_FAILED':
        return new AuthError('validation', api.message, api.fieldErrors);
      case 'INVALID_CREDENTIALS':
        return new AuthError('credentials', api.message);
      default:
        return this.fromOther(api);
    }
  }

  private fromOther(api: ApiError): AuthError {
    if (api.status >= 500) return new AuthError('server', api.message);
    // Un 401 sin código (backend anterior al contrato): en el login solo puede significar credenciales malas.
    if (api.status === 401) return new AuthError('credentials', DEFAULT_CREDENTIALS_MESSAGE);
    return new AuthError('credentials', api.message);
  }
}
