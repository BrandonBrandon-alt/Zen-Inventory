import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { authGuard } from './auth.guard';
import { AuthStore } from './auth-store';

const run = () =>
  TestBed.runInInjectionContext(() =>
    authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );

describe('authGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    // Doble mínimo: devuelve los comandos para poder afirmar el destino sin armar rutas reales.
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } }],
    });
  });

  it('permite el paso con sesión', () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'n', rol: 'r', id: 1 });
    expect(run()).toBe(true);
  });

  it('sin sesión redirige a /login', () => {
    expect(run()).toEqual(['/login']);
  });
});
