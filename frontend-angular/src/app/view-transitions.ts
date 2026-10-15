import type { ActivatedRouteSnapshot } from '@angular/router';

/**
 * Mientras una transición de vistas está en curso el navegador no deja interactuar con la página. Por eso solo se
 * usa entre pantallas del shell (donde se nota y dura ~300 ms), no al entrar o salir del login: ahí un clic
 * justo después de iniciar sesión se perdería.
 */
export function skipsViewTransition(from: ActivatedRouteSnapshot, to: ActivatedRouteSnapshot): boolean {
  return isLogin(from) || isLogin(to);
}

function isLogin(snapshot: ActivatedRouteSnapshot): boolean {
  return snapshot.firstChild?.routeConfig?.path === 'login';
}
