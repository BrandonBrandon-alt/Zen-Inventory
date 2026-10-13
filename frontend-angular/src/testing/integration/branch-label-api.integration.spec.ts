import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import type { AuthSession } from '@core/auth/session/auth-session';
import {
  BranchLabelApi,
  DEFAULT_BRANCH_LABEL,
  GLOBAL_LABEL,
} from '../../app/layout/data-access/branch-label-api';
import { server, TEST_API } from '../msw-server';

const session = (overrides: Partial<AuthSession>): AuthSession => ({
  token: 't',
  email: 'e@z.com',
  nombre: 'Ana',
  rol: 'MANAGER',
  id: 1,
  ...overrides,
});

describe('BranchLabelApi (contrato HTTP con MSW)', () => {
  let api: BranchLabelApi;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }],
    });
    api = TestBed.inject(BranchLabelApi);
  });

  it('un ADMIN ve "Gestión Global" sin llamar al backend', async () => {
    let calls = 0;
    server.use(
      http.get(`${TEST_API}/api/branches/:id`, () => {
        calls++;
        return HttpResponse.json({ nombre: 'Norte' });
      }),
    );
    expect(await firstValueFrom(api.labelFor(session({ rol: 'ADMIN', sucursalId: 3 })))).toBe(GLOBAL_LABEL);
    expect(calls).toBe(0);
  });

  it('un usuario de sucursal ve el nombre de su sucursal', async () => {
    server.use(http.get(`${TEST_API}/api/branches/3`, () => HttpResponse.json({ id: 3, nombre: '  Norte  ' })));
    expect(await firstValueFrom(api.labelFor(session({ sucursalId: 3 })))).toBe('Norte');
  });

  it('sin sucursalId usa la etiqueta por defecto sin llamar al backend', async () => {
    expect(await firstValueFrom(api.labelFor(session({})))).toBe(DEFAULT_BRANCH_LABEL);
  });

  it.each([
    ['404', () => new HttpResponse(null, { status: 404 })],
    ['500', () => new HttpResponse(null, { status: 500 })],
    ['error de red', () => HttpResponse.error()],
    ['nombre vacío', () => HttpResponse.json({ id: 3, nombre: '   ' })],
    ['sin nombre', () => HttpResponse.json({ id: 3 })],
  ])('ante %s usa la etiqueta por defecto', async (_caso, responder) => {
    server.use(http.get(`${TEST_API}/api/branches/3`, responder));
    expect(await firstValueFrom(api.labelFor(session({ sucursalId: 3 })))).toBe(DEFAULT_BRANCH_LABEL);
  });
});
