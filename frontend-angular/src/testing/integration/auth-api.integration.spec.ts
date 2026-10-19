import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { AuthApi, AuthError } from '@core/auth/http/auth-api';
import { authInterceptor } from '@core/auth/http/auth.interceptor';
import { AuthStore } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, okLogin, server, TEST_API } from '../msw-server';

const credentials = { email: 'ana@zen.com', password: 'secreto' };
const LOGIN = `${TEST_API}/api/auth/login`;

describe('AuthApi (contrato HTTP real con MSW)', () => {
  let api: AuthApi;
  let store: AuthStore;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
        { provide: API_BASE_URL, useValue: TEST_API },
        { provide: Router, useValue: { navigateByUrl: vi.fn() } },
      ],
    });
    api = TestBed.inject(AuthApi);
    store = TestBed.inject(AuthStore);
  });

  const fail = (): Promise<unknown> => api.login(credentials).catch((e: unknown) => e);

  it('envía email y password por POST y guarda la sesión', async () => {
    let received: unknown;
    server.use(
      http.post(LOGIN, async ({ request }) => {
        received = await request.json();
        return HttpResponse.json(okLogin);
      }),
    );
    const session = await api.login(credentials);
    expect(received).toEqual(credentials);
    expect(session).toEqual({ token: 'jwt-123', email: 'ana@zen.com', nombre: 'Ana', rol: 'ADMIN', id: 7, sucursalId: 3 });
    expect(store.session()).toEqual(session);
  });

  it('guarda la versión de la foto de perfil que devuelve el login', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ ...okLogin, avatarActualizadoEn: '2026-10-01T08:00:00' })));
    const session = await api.login(credentials);
    expect(session.avatarVersion).toBe('2026-10-01T08:00:00');
  });

  it('un usuario sin foto (el servidor manda avatarActualizadoEn: null) inicia sesión sin problema', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ ...okLogin, avatarActualizadoEn: null })));
    const session = await api.login(credentials);
    expect(session.avatarVersion).toBeUndefined();
    expect(store.isAuthenticated()).toBe(true);
  });

  it('un administrador sin sucursal (el servidor manda sucursalId: null) inicia sesión y queda sin sucursal', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ ...okLogin, rol: 'ADMIN', sucursalId: null })));
    const session = await api.login(credentials);
    expect(session.sucursalId).toBeUndefined();
    expect(store.isAuthenticated()).toBe(true);
    expect(store.role()).toBe('ADMIN');
  });

  it('INVALID_CREDENTIALS (contraseña incorrecta o correo inexistente): "credentials" con el mensaje del backend y sin sesión', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json(apiErrorBody(401, 'INVALID_CREDENTIALS', 'Credenciales incorrectas'), { status: 401 })));
    const error = await fail();
    expect(error).toBeInstanceOf(AuthError);
    expect(error).toMatchObject({ kind: 'credentials', message: 'Credenciales incorrectas' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('backend anterior al contrato (401 solo con message): "credentials" con mensaje genérico', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ message: 'Credenciales incorrectas' }, { status: 401 })));
    expect(await fail()).toMatchObject({ kind: 'credentials', message: 'Credenciales incorrectas. Inténtalo de nuevo.' });
  });

  it('401 sin cuerpo: mensaje genérico legible', async () => {
    server.use(http.post(LOGIN, () => new HttpResponse(null, { status: 401 })));
    expect(await fail()).toMatchObject({ kind: 'credentials', message: 'Credenciales incorrectas. Inténtalo de nuevo.' });
  });

  it('TOO_MANY_REQUESTS (429): se muestra el mensaje del backend y no hay sesión', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(apiErrorBody(429, 'TOO_MANY_REQUESTS', 'Demasiados intentos fallidos. Espera unos minutos antes de intentarlo de nuevo.'), { status: 429 }),
      ),
    );
    expect(await fail()).toMatchObject({ kind: 'credentials', message: expect.stringContaining('Demasiados intentos') });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('ACCOUNT_DISABLED: "disabled" con el mensaje del backend', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(apiErrorBody(401, 'ACCOUNT_DISABLED', 'La cuenta está desactivada. Por favor, contacte al administrador.'), { status: 401 }),
      ),
    );
    expect(await fail()).toMatchObject({ kind: 'disabled', message: 'La cuenta está desactivada. Por favor, contacte al administrador.' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('VALIDATION_FAILED: "validation" con los errores por campo', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(
          apiErrorBody(400, 'VALIDATION_FAILED', 'email: Formato de email inválido', {
            fieldErrors: [{ field: 'email', message: 'Formato de email inválido' }],
          }),
          { status: 400 },
        ),
      ),
    );
    expect(await fail()).toMatchObject({ kind: 'validation', fieldErrors: { email: 'Formato de email inválido' } });
  });

  it('respuesta sin token (campos opcionales ausentes): "invalid-response", sin sesión parcial', async () => {
    server.use(http.post(LOGIN, () => HttpResponse.json({ email: 'ana@zen.com' })));
    expect(await fail()).toMatchObject({ kind: 'invalid-response' });
    expect(store.isAuthenticated()).toBe(false);
  });

  it('error 500 con contrato: "server" con el mensaje del backend (incluye el traceId), no "credenciales"', async () => {
    server.use(
      http.post(LOGIN, () =>
        HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'Ocurrió un error inesperado… código: a1b2c3d4'), { status: 500 }),
      ),
    );
    const error = await fail();
    expect(error).toMatchObject({ kind: 'server' });
    expect((error as AuthError).message).toContain('a1b2c3d4');
  });

  it('error 500 sin cuerpo: "server" con mensaje propio legible', async () => {
    server.use(http.post(LOGIN, () => new HttpResponse(null, { status: 500 })));
    const error = (await fail()) as AuthError;
    expect(error.kind).toBe('server');
    expect(error.message).not.toBe('');
  });

  it('proxy caído (502 con HTML): "network" con el mensaje de servidor no disponible', async () => {
    server.use(http.post(LOGIN, () => new HttpResponse('<html>Bad Gateway</html>', { status: 502, headers: { 'Content-Type': 'text/html' } })));
    const error = (await fail()) as AuthError;
    expect(error.kind).toBe('network');
    expect(error.message).toContain('no está disponible');
  });

  it('backend caído / error de red: "network" y la sesión previa no se toca', async () => {
    store.start({ token: 'old', email: 'x@z.com', nombre: 'X', rol: 'USER', id: 1 });
    server.use(http.post(LOGIN, () => HttpResponse.error()));
    const error = (await fail()) as AuthError;
    expect(error.kind).toBe('network');
    expect(error.message).toContain('No se pudo conectar');
    expect(store.token()).toBe('old');
  });

  it('los fallos del login se muestran en su formulario: nunca generan un aviso global duplicado', async () => {
    const notifications = TestBed.inject(NotificationService);
    server.use(http.post(LOGIN, () => HttpResponse.error()));
    await fail();
    server.use(http.post(LOGIN, () => new HttpResponse(null, { status: 500 })));
    await fail();
    expect(notifications.items()).toEqual([]);
  });
});
