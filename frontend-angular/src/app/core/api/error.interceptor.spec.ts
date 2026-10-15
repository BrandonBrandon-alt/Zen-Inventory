import { HttpClient, HttpContext, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthStore } from '../auth/session/auth-store';
import { NotificationService } from '../notifications/notification.service';
import { ApiError } from './api-error';
import { SKIP_ERROR_NOTIFICATION, errorInterceptor } from './error.interceptor';

describe('errorInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let notifications: NotificationService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    notifications = TestBed.inject(NotificationService);
  });

  function fail(status: number, body: object | string | null, context?: HttpContext): unknown {
    let received: unknown;
    http.get('/api/x', { context }).subscribe({ error: (e: unknown) => (received = e) });
    controller.expectOne('/api/x').flush(body, { status, statusText: 'x' });
    return received;
  }

  it('entrega un ApiError normalizado en lugar del HttpErrorResponse', () => {
    const error = fail(409, { code: 'DUPLICATE_SKU', message: 'Ya existe un producto con el SKU indicado.' });
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 409, code: 'DUPLICATE_SKU' });
  });

  it.each([
    [400, { code: 'VALIDATION_FAILED', message: 'x', fieldErrors: [{ field: 'a', message: 'b' }] }],
    [404, { code: 'RESOURCE_NOT_FOUND', message: 'No existe' }],
    [409, { code: 'DUPLICATE_SKU', message: 'Duplicado' }],
    [422, { code: 'INSUFFICIENT_STOCK', message: 'Sin stock' }],
    [401, { code: 'INVALID_CREDENTIALS', message: 'Credenciales incorrectas' }],
  ])('un %s lo maneja la pantalla: no se muestra aviso global', (status, body) => {
    fail(status, body);
    expect(notifications.items()).toEqual([]);
  });

  it('un error de red muestra un aviso de error', () => {
    let received: unknown;
    http.get('/api/x').subscribe({ error: (e: unknown) => (received = e) });
    controller.expectOne('/api/x').error(new ProgressEvent('error'));
    expect(received).toMatchObject({ code: 'NETWORK_ERROR' });
    expect(notifications.items()).toHaveLength(1);
    expect(notifications.items()[0]).toMatchObject({ kind: 'error' });
    expect(notifications.items()[0].message).toContain('No se pudo conectar');
  });

  it('un 500 del servidor muestra un aviso de error con el mensaje del backend', () => {
    fail(500, { code: 'INTERNAL_ERROR', message: 'Ocurrió un error inesperado… código: a1b2c3d4', traceId: 'a1b2c3d4' });
    expect(notifications.items()[0]).toMatchObject({ kind: 'error' });
    expect(notifications.items()[0].message).toContain('a1b2c3d4');
  });

  it('un 502 del proxy (HTML) muestra el aviso de servidor no disponible', () => {
    fail(502, '<html>Bad Gateway</html>');
    expect(notifications.items()[0].message).toContain('no está disponible');
  });

  it('un 403 muestra un aviso (advertencia) de permisos', () => {
    fail(403, { code: 'ACCESS_DENIED', message: 'No tienes permisos para realizar esta acción.' });
    expect(notifications.items()[0]).toMatchObject({ kind: 'warning', message: 'No tienes permisos para realizar esta acción.' });
  });

  it('un token vencido avisa que la sesión expiró (el usuario tenía sesión)', () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'n', rol: 'ADMIN', id: 1 });
    fail(401, { code: 'TOKEN_EXPIRED', message: 'Tu sesión expiró. Inicia sesión de nuevo.' });
    expect(notifications.items()[0]).toMatchObject({ kind: 'warning', message: 'Tu sesión expiró. Inicia sesión de nuevo.' });
  });

  it('el aviso de sesión vencida no se suprime aunque la pantalla pida manejar sus propios errores', () => {
    TestBed.inject(AuthStore).start({ token: 't', email: 'e', nombre: 'n', rol: 'ADMIN', id: 1 });
    fail(401, { code: 'TOKEN_EXPIRED', message: 'Tu sesión expiró. Inicia sesión de nuevo.' }, new HttpContext().set(SKIP_ERROR_NOTIFICATION, true));
    expect(notifications.items()).toHaveLength(1);
  });

  it('sin sesión previa un 401 de sesión no avisa "tu sesión expiró" (no había sesión que expirar)', () => {
    fail(401, { code: 'UNAUTHENTICATED', message: 'Debes iniciar sesión para acceder a este recurso.' });
    expect(notifications.items()).toEqual([]);
  });

  it('varias peticiones que fallan a la vez generan un solo aviso', () => {
    for (let i = 0; i < 3; i++) {
      http.get('/api/x').subscribe({ error: () => undefined });
    }
    controller.match('/api/x').forEach((r) => r.error(new ProgressEvent('error')));
    expect(notifications.items()).toHaveLength(1);
  });

  it('SKIP_ERROR_NOTIFICATION permite que la pantalla maneje el error sin aviso global', () => {
    const error = fail(500, null, new HttpContext().set(SKIP_ERROR_NOTIFICATION, true));
    expect(error).toBeInstanceOf(ApiError);
    expect(notifications.items()).toEqual([]);
  });
});
