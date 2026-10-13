import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { DASHBOARD_URL, LOGIN_URL } from './auth-urls';
import { AuthStore } from './auth-store';
import type { Role } from './role';

/**
 * Restringe una ruta a ciertos roles. Una sesión sin rol reconocido se considera inválida:
 * se cierra y se vuelve al login (redirigir al panel crearía un bucle, porque el panel también valida el rol).
 */
export const roleGuard =
  (...allowed: Role[]): CanActivateFn =>
  () => {
    const store = inject(AuthStore);
    const router = inject(Router);
    const role = store.role();
    if (role === null) {
      store.clear();
      return router.createUrlTree([LOGIN_URL]);
    }
    return allowed.includes(role) ? true : router.createUrlTree([DASHBOARD_URL]);
  };
