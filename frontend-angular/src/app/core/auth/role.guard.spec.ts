import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from './auth-store';
import { roleGuard } from './role.guard';

const run = (...allowed: Parameters<typeof roleGuard>) =>
  TestBed.runInInjectionContext(() =>
    roleGuard(...allowed)({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
  );

const sessionWith = (rol: string) => ({ token: 't', email: 'e', nombre: 'n', rol, id: 1 });

describe('roleGuard', () => {
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    // Doble mínimo: devuelve los comandos para poder afirmar el destino sin armar rutas reales.
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } }],
    });
    store = TestBed.inject(AuthStore);
  });

  it('permite el paso a un rol incluido', () => {
    store.start(sessionWith('MANAGER'));
    expect(run('ADMIN', 'MANAGER')).toBe(true);
  });

  it('redirige al panel si el rol no está incluido', () => {
    store.start(sessionWith('OPERADOR_INVENTARIO'));
    expect(run('ADMIN')).toEqual(['/dashboard']);
    expect(store.isAuthenticated()).toBe(true);
  });

  it('sin sesión redirige a /login', () => {
    expect(run('ADMIN')).toEqual(['/login']);
  });

  it('con un rol desconocido cierra la sesión y redirige a /login (evita bucles)', () => {
    store.start(sessionWith('INVENTADO'));
    expect(run('ADMIN', 'MANAGER', 'SELLER', 'OPERADOR_INVENTARIO')).toEqual(['/login']);
    expect(store.isAuthenticated()).toBe(false);
  });
});
