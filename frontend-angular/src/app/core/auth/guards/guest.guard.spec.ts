import { TestBed } from '@angular/core/testing';
import { Router, type ActivatedRouteSnapshot, type RouterStateSnapshot } from '@angular/router';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '../session/auth-store';
import { guestGuard } from './guest.guard';

const run = () =>
  TestBed.runInInjectionContext(() => guestGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot));

describe('guestGuard', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [{ provide: Router, useValue: { createUrlTree: (commands: string[]) => commands } }],
    });
  });

  it('permite entrar al login sin sesión', () => {
    expect(run()).toBe(true);
  });

  it('con sesión redirige al panel', () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'n', rol: 'ADMIN', id: 1 });
    expect(run()).toEqual(['/dashboard']);
  });
});
