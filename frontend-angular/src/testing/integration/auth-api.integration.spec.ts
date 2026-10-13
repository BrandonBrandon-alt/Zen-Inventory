import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthApi, AuthError } from '@core/auth/http/auth-api';
import { authInterceptor } from '@core/auth/http/auth.interceptor';
import { AuthStore } from '@core/auth/session/auth-store';
import { okLogin, server, TEST_API } from '../msw-server';

const credentials = { email: 'ana@zen.com', password: 'secreto' };

describe('AuthApi (contrato HTTP real con MSW)', () => {
  let api: AuthApi;
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        { provide: API_BASE_URL, useValue: TEST_API },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
      ],
    });
    api = TestBed.inject(AuthApi);
    store = TestBed.inject(AuthStore);
  });

  it('envía email y password por POST y guarda la sesión', async () => {
    let received: unknown;
    server.use(
      http.post(`${TEST_API}/api/auth/login`, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(okLogin);
      }),
    );
    const session = await api.login(credentials);
    expect(received).toEqual(credentials);
    expect(session).toEqual({
      token: 'jwt-123',
      email: 'ana@zen.com',
      nombre: 'Ana',
      rol: 'ADMIN',
      id: 7,
      sucursalId: 3,
    });
    expect(store.session()).toEqual(session);
  });

  it('credenciales incorrectas (401): AuthError "credentials" con el mensaje del backend y sin sesión', async () => {
    server.use(
      http.post(`${TEST_API}/api/auth/login`, () =>
        HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 }),
      ),
    );
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ kind: 'credentials', message: 'Credenciales incorrectas' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('401 sin cuerpo: mensaje genérico legible', async () => {
    server.use(http.post(`${TEST_API}/api/auth/login`, () => new HttpResponse(null, { status: 401 })));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({
      kind: 'credentials',
      message: 'Credenciales incorrectas. Inténtalo de nuevo.',
    });
  });

  it('error 500 del servidor: AuthError "server", no se presenta como credenciales incorrectas', async () => {
    server.use(http.post(`${TEST_API}/api/auth/login`, () => new HttpResponse(null, { status: 500 })));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({
      kind: 'server',
      message: 'El servidor no pudo procesar la solicitud. Inténtalo más tarde.',
    });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('respuesta sin token (campos opcionales ausentes): AuthError "invalid-response", sin sesión parcial', async () => {
    server.use(http.post(`${TEST_API}/api/auth/login`, () => HttpResponse.json({ email: 'ana@zen.com' })));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'invalid-response' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('backend caído / error de red: AuthError "network" y la sesión previa no se toca', async () => {
    store.start({ token: 'old', email: 'x@z.com', nombre: 'X', rol: 'USER', id: 1 });
    server.use(http.post(`${TEST_API}/api/auth/login`, () => HttpResponse.error()));
    const error = await api.login(credentials).catch((e: unknown) => e);
    expect(error).toMatchObject({ kind: 'network', message: 'No se pudo conectar con el servidor.' });
    expect(store.token()).toBe('old');
  });
});
