import { HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { LOGIN_ENDPOINT, LOGIN_URL } from './auth-urls';
import { AuthStore } from './auth-store';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const store = inject(AuthStore);
  const router = inject(Router);

  const isLoginCall = req.url.endsWith(LOGIN_ENDPOINT);
  const token = store.token();
  const outgoing =
    token && !isLoginCall ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(outgoing).pipe(
    catchError((error: unknown) => {
      const sessionExpired =
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
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
