import { HttpContextToken, HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { NotificationService } from '../notifications/notification.service';
import { toApiError } from './api-error';

/** Una pantalla que muestra ella misma el error (p. ej. el login) lo marca para evitar el aviso global duplicado. */
export const SKIP_ERROR_NOTIFICATION = new HttpContextToken<boolean>(() => false);

/**
 * Normaliza cualquier fallo HTTP a `ApiError` y avisa de forma global solo de los que no pertenecen a un
 * formulario (red, servidor, permisos, sesión). Los 400/404/409/422 los maneja la pantalla que hizo la llamada.
 *
 * Va ANTES de `authInterceptor` en la lista: así ve el error ya tratado (sesión cerrada) y solo lo convierte.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const notifications = inject(NotificationService);

  return next(req).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) return throwError(() => error);
      const apiError = toApiError(error);
      if (apiError.isGlobal && !req.context.get(SKIP_ERROR_NOTIFICATION)) {
        const soft = apiError.code === 'ACCESS_DENIED' || apiError.isSessionProblem;
        notifications.show(soft ? 'warning' : 'error', apiError.message);
      }
      return throwError(() => apiError);
    }),
  );
};
