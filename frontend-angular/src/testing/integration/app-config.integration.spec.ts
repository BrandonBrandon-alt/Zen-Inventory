import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { appConfig } from '../../app/app.config';
import { API_BASE_URL } from '@core/api/api-base-url';
import { AuthStore } from '@core/auth/session/auth-store';
import { THEME_STORAGE_KEY } from '@core/theme/theme.service';
import { ApiError } from '@core/api/api-error';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '../msw-server';

describe('appConfig (cableado real de la app)', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, { provide: API_BASE_URL, useValue: TEST_API }],
    });
  });

  it('HttpClient está provisto y el interceptor adjunta el JWT a la API', async () => {
    TestBed.inject(AuthStore).start({
      token: 'jwt-123',
      email: 'a@z.com',
      nombre: 'A',
      rol: 'ADMIN',
      id: 1,
    });
    let authorization: string | null = null;
    server.use(
      http.get(`${TEST_API}/api/ping`, ({ request }) => {
        authorization = request.headers.get('Authorization');
        return HttpResponse.json({ ok: true });
      }),
    );

    await firstValueFrom(TestBed.inject(HttpClient).get(`${TEST_API}/api/ping`));

    expect(authorization).toBe('Bearer jwt-123');
  });

  it('al arrancar aplica el tema guardado sin que nadie pida el servicio', () => {
    delete document.documentElement.dataset['theme'];
    localStorage.setItem(THEME_STORAGE_KEY, 'light');
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [...appConfig.providers] });

    TestBed.inject(HttpClient); // fuerza la creación del módulo de pruebas y sus inicializadores

    expect(document.documentElement.dataset['theme']).toBe('light');
  });

  it('un 401 TOKEN_EXPIRED llega como ApiError, cierra la sesión y avisa (orden correcto de los interceptores)', async () => {
    const store = TestBed.inject(AuthStore);
    store.start({ token: 'jwt-123', email: 'a@z.com', nombre: 'A', rol: 'ADMIN', id: 1 });
    server.use(
      http.get(`${TEST_API}/api/ping`, () =>
        HttpResponse.json(apiErrorBody(401, 'TOKEN_EXPIRED', 'Tu sesión expiró. Inicia sesión de nuevo.'), { status: 401 }),
      ),
    );

    const error = await firstValueFrom(TestBed.inject(HttpClient).get(`${TEST_API}/api/ping`)).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: 'TOKEN_EXPIRED', status: 401 });
    expect(store.isAuthenticated()).toBe(false);
    expect(TestBed.inject(NotificationService).items()).toHaveLength(1);
  });
});
