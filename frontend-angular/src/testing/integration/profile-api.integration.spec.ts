import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { http, HttpResponse } from 'msw';
import { firstValueFrom } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { ProfileApi } from '../../app/features/profile/data-access/profile-api';
import { apiErrorBody, server, TEST_API } from '../msw-server';

const PROFILE = `${TEST_API}/api/profile`;
const USER = { id: 7, nombre: ' Ana Pérez ', email: 'ana@zen.com', role: { id: 4, nombre: 'SELLER' }, sucursalId: 3, activo: true };

describe('ProfileApi (contrato HTTP)', () => {
  let api: ProfileApi;

  beforeEach(() => {
    localStorage.clear();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
    });
    api = TestBed.inject(ProfileApi);
  });

  it('get() lee el perfil y normaliza los campos', async () => {
    server.use(http.get(PROFILE, () => HttpResponse.json({ ...USER, avatarActualizadoEn: '2026-10-01T08:00:00' })));
    expect(await firstValueFrom(api.get())).toEqual({
      id: 7,
      nombre: 'Ana Pérez',
      email: 'ana@zen.com',
      rol: 'SELLER',
      sucursalId: 3,
      avatarVersion: '2026-10-01T08:00:00',
    });
  });

  it('sin foto, avatarVersion es null', async () => {
    server.use(http.get(PROFILE, () => HttpResponse.json(USER)));
    expect((await firstValueFrom(api.get())).avatarVersion).toBeNull();
  });

  it('un perfil sin id o sin correo se rechaza', async () => {
    server.use(http.get(PROFILE, () => HttpResponse.json({ nombre: 'X' })));
    await expect(firstValueFrom(api.get())).rejects.toThrow('incompleto');
  });

  it('updateName() envía solo el nombre por PUT', async () => {
    let body: unknown;
    server.use(
      http.put(PROFILE, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(USER);
      }),
    );
    await firstValueFrom(api.updateName('Ana Pérez'));
    expect(body).toEqual({ nombre: 'Ana Pérez' });
  });

  it('changePassword() envía la actual y la nueva con los nombres del contrato', async () => {
    let body: unknown;
    server.use(
      http.put(`${PROFILE}/password`, async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 204 });
      }),
    );
    await firstValueFrom(api.changePassword('vieja123', 'nueva456'));
    expect(body).toEqual({ contrasenaActual: 'vieja123', contrasenaNueva: 'nueva456' });
  });

  it('removeAvatar() usa DELETE y devuelve el perfil sin foto', async () => {
    server.use(http.delete(`${PROFILE}/avatar`, () => HttpResponse.json(USER)));
    expect((await firstValueFrom(api.removeAvatar())).avatarVersion).toBeNull();
  });

  it('un error de validación llega a la pantalla sin aviso global duplicado', async () => {
    const notifications = TestBed.inject(NotificationService);
    server.use(http.put(`${PROFILE}/password`, () => HttpResponse.json(apiErrorBody(400, 'INVALID_ARGUMENT', 'La contraseña actual no es correcta.'), { status: 400 })));
    await expect(firstValueFrom(api.changePassword('mala', 'nueva456'))).rejects.toMatchObject({
      status: 400,
      message: 'La contraseña actual no es correcta.',
    });
    expect(notifications.items()).toHaveLength(0);
  });
});

// Aparte: jsdom no sabe enviar un FormData con archivo por su XMLHttpRequest (MSW lo corta), así que aquí se
// intercepta la petición ya armada en vez de pasar por la red simulada.
describe('ProfileApi.uploadAvatar (forma de la petición)', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), { provide: API_BASE_URL, useValue: TEST_API }],
    });
  });

  it('uploadAvatar() envía el archivo como multipart en el campo "archivo"', () => {
    const controller = TestBed.inject(HttpTestingController);
    const file = new File([new Uint8Array([1, 2, 3])], 'yo.png', { type: 'image/png' });
    let avatarVersion: string | null = null;
    TestBed.inject(ProfileApi).uploadAvatar(file).subscribe((profile) => (avatarVersion = profile.avatarVersion));
    const request = controller.expectOne(`${PROFILE}/avatar`);
    expect(request.request.method).toBe('PUT');
    const body = request.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect((body.get('archivo') as File).name).toBe('yo.png');
    // Sin cabecera Content-Type propia: el navegador agrega el límite (boundary) del multipart.
    expect(request.request.headers.has('Content-Type')).toBe(false);
    request.flush({ ...USER, avatarActualizadoEn: '2026-10-02T09:00:00' });
    expect(avatarVersion).toBe('2026-10-02T09:00:00');
    controller.verify();
  });
});
