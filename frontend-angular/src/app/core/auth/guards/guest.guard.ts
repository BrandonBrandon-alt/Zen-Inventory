import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { DASHBOARD_URL } from '../auth-urls';
import { AuthStore } from '../session/auth-store';

/** Para pantallas públicas (login): quien ya tiene sesión va directo al panel. */
export const guestGuard: CanActivateFn = () =>
  inject(AuthStore).isAuthenticated() ? inject(Router).createUrlTree([DASHBOARD_URL]) : true;
