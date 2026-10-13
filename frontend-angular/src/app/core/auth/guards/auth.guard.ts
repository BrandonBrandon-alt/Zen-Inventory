import { inject } from '@angular/core';
import { type CanActivateFn, Router } from '@angular/router';
import { LOGIN_URL } from '../auth-urls';
import { AuthStore } from '../session/auth-store';

export const authGuard: CanActivateFn = () => {
  const store = inject(AuthStore);
  return store.isAuthenticated() ? true : inject(Router).createUrlTree([LOGIN_URL]);
};
