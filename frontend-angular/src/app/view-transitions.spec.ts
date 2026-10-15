import type { ActivatedRouteSnapshot } from '@angular/router';
import { describe, expect, it } from 'vitest';
import { skipsViewTransition } from './view-transitions';

/** Árbol mínimo: la raíz tiene un hijo (la ruta de primer nivel) con su `path`. */
const snapshot = (topLevelPath: string): ActivatedRouteSnapshot =>
  ({ firstChild: { routeConfig: { path: topLevelPath } } }) as ActivatedRouteSnapshot;

describe('skipsViewTransition', () => {
  it('entre pantallas del shell sí hay transición', () => {
    expect(skipsViewTransition(snapshot(''), snapshot(''))).toBe(false);
  });

  it('al entrar al login no hay transición', () => {
    expect(skipsViewTransition(snapshot(''), snapshot('login'))).toBe(true);
  });

  it('al salir del login (iniciar sesión) no hay transición: bloquearía los clics justo después de entrar', () => {
    expect(skipsViewTransition(snapshot('login'), snapshot(''))).toBe(true);
  });

  it('sin hijos o sin configuración de ruta no falla y deja la transición activa', () => {
    const empty = {} as ActivatedRouteSnapshot;
    expect(skipsViewTransition(empty, empty)).toBe(false);
  });
});
