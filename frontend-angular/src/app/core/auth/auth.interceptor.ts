import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-base-url';
import { LOGIN_ENDPOINT, LOGIN_URL } from './auth-urls';
import { AuthStore } from './auth-store';

/**
 * Adjunta el JWT solo a las peticiones a nuestra API (nunca a terceros) y cierra la sesión
 * cuando el backend responde 401 a una petición autenticada.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);
  const baseUrl = inject(API_BASE_URL);

  // Con base vacía la API es del mismo origen (URLs relativas); con base absoluta, solo esa.
  const isApiCall = baseUrl ? req.url.startsWith(baseUrl) : req.url.startsWith('/');
  const isLoginCall = req.url.endsWith(LOGIN_ENDPOINT);
  const token = store.token();
  const outgoing =
    token && isApiCall && !isLoginCall
      ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
      : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const sessionExpired =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        isApiCall &&
        !isLoginCall &&
        store.isAuthenticated();
      if (sessionExpired) {
        store.clear();
        void router.navigateByUrl(LOGIN_URL);
      }
      return throwError(() => error);
    }),
  );
};
