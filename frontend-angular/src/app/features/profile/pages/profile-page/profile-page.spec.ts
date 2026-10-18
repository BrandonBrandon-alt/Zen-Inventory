import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@core/api/api-error';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { AuthStore, SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { ProfileApi } from '../../data-access/profile-api';
import { ProfilePage } from './profile-page';

const PROFILE = `${TEST_API}/api/profile`;
const USER = { id: 7, nombre: 'Ana Pérez', email: 'ana@zen.com', role: { id: 4, nombre: 'SELLER' }, sucursalId: 3, activo: true };

function useSession(extra: Record<string, unknown> = {}) {
  localStorage.setItem(
    SESSION_STORAGE_KEY,
    JSON.stringify({ token: 't', email: 'ana@zen.com', nombre: 'Ana Pérez', rol: 'SELLER', id: 7, sucursalId: 3, ...extra }),
  );
}

const renderPage = () =>
  render(ProfilePage, {
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });

const fileInput = () => screen.getByLabelText('Archivo de la foto de perfil') as HTMLInputElement;
const png = (name = 'yo.png', type = 'image/png', size = 10) => new File([new Uint8Array(size)], name, { type });

describe('ProfilePage', () => {
  beforeEach(() => {
    localStorage.clear();
    URL.createObjectURL = vi.fn(() => 'blob:foto');
    URL.revokeObjectURL = vi.fn();
    server.use(
      http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([{ id: 3, nombre: 'Sucursal Norte', activa: true }])),
      http.get(`${TEST_API}/api/avatars/7`, () => new HttpResponse(new Uint8Array([1]), { headers: { 'Content-Type': 'image/jpeg' } })),
    );
  });
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('muestra los datos de la cuenta: correo, rol y sucursal (solo lectura)', async () => {
    useSession();
    await renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'Mi perfil' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('ana@zen.com')).toBeInTheDocument();
    expect(screen.getByText('SELLER')).toBeInTheDocument();
    expect(await screen.findByText('Sucursal Norte')).toBeInTheDocument();
  });

  it('el ADMIN ve "Gestión Global" en lugar de una sucursal', async () => {
    useSession({ rol: 'ADMIN', sucursalId: undefined });
    await renderPage();
    expect(await screen.findByText('Gestión Global')).toBeInTheDocument();
  });

  describe('nombre', () => {
    it('"Guardar nombre" está deshabilitado hasta que se cambia algo', async () => {
      useSession();
      await renderPage();
      expect(screen.getByRole('button', { name: 'Guardar nombre' })).toBeDisabled();
      await userEvent.type(screen.getByLabelText('Nombre completo'), 'x');
      expect(screen.getByRole('button', { name: 'Guardar nombre' })).toBeEnabled();
    });

    it('guarda el nombre y actualiza la sesión (se refleja en toda la app)', async () => {
      useSession();
      let body: unknown;
      server.use(
        http.put(PROFILE, async ({ request }) => {
          body = await request.json();
          return HttpResponse.json({ ...USER, nombre: 'Ana María Pérez' });
        }),
      );
      await renderPage();
      const input = screen.getByLabelText('Nombre completo');
      await userEvent.clear(input);
      await userEvent.type(input, 'Ana María Pérez');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
      await vi.waitFor(() => expect(TestBed.inject(AuthStore).session()?.nombre).toBe('Ana María Pérez'));
      expect(body).toEqual({ nombre: 'Ana María Pérez' });
      expect(TestBed.inject(NotificationService).items().some((n) => n.message === 'Nombre actualizado.')).toBe(true);
      expect(await screen.findByRole('button', { name: 'Guardar nombre' })).toBeDisabled();
    });

    it('un nombre demasiado corto no se envía', async () => {
      useSession();
      let called = false;
      server.use(http.put(PROFILE, () => ((called = true), HttpResponse.json(USER))));
      await renderPage();
      const input = screen.getByLabelText('Nombre completo');
      await userEvent.clear(input);
      await userEvent.type(input, 'Al');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
      expect(await screen.findByText('El nombre debe tener al menos 3 caracteres.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('muestra el error del servidor y no toca la sesión', async () => {
      useSession();
      server.use(http.put(PROFILE, () => HttpResponse.json(apiErrorBody(500, 'INTERNAL_ERROR', 'No se pudo guardar.'), { status: 500 })));
      await renderPage();
      await userEvent.type(screen.getByLabelText('Nombre completo'), 'x');
      await userEvent.click(screen.getByRole('button', { name: 'Guardar nombre' }));
      expect(await screen.findByText('No se pudo guardar.')).toBeInTheDocument();
      expect(TestBed.inject(AuthStore).session()?.nombre).toBe('Ana Pérez');
    });
  });

  describe('contraseña', () => {
    const fill = async (current: string, next: string, confirm: string) => {
      await userEvent.type(screen.getByLabelText('Contraseña actual'), current);
      await userEvent.type(screen.getByLabelText('Contraseña nueva'), next);
      await userEvent.type(screen.getByLabelText('Repite la contraseña nueva'), confirm);
      await userEvent.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
    };

    it('cambia la contraseña, avisa y deja el formulario vacío', async () => {
      useSession();
      let body: unknown;
      server.use(
        http.put(`${PROFILE}/password`, async ({ request }) => {
          body = await request.json();
          return new HttpResponse(null, { status: 204 });
        }),
      );
      await renderPage();
      await fill('vieja123', 'nueva456', 'nueva456');
      await vi.waitFor(() => expect(TestBed.inject(NotificationService).items().some((n) => n.message === 'Contraseña actualizada.')).toBe(true));
      expect(body).toEqual({ contrasenaActual: 'vieja123', contrasenaNueva: 'nueva456' });
      expect(screen.getByLabelText('Contraseña actual')).toHaveValue('');
    });

    it('si la confirmación no coincide no envía nada', async () => {
      useSession();
      let called = false;
      server.use(http.put(`${PROFILE}/password`, () => ((called = true), new HttpResponse(null, { status: 204 }))));
      await renderPage();
      await fill('vieja123', 'nueva456', 'otra4567');
      expect(await screen.findByText('Las contraseñas no coinciden.')).toBeInTheDocument();
      expect(called).toBe(false);
    });

    it('rechaza una contraseña nueva igual a la actual', async () => {
      useSession();
      await renderPage();
      await fill('misma1234', 'misma1234', 'misma1234');
      expect(await screen.findByText('La contraseña nueva debe ser distinta de la actual.')).toBeInTheDocument();
    });

    it('rechaza una contraseña nueva de menos de 6 caracteres', async () => {
      useSession();
      await renderPage();
      await fill('vieja123', '123', '123');
      expect(await screen.findByText('Mínimo 6 caracteres.')).toBeInTheDocument();
    });

    it('con la contraseña actual incorrecta muestra el mensaje del servidor y conserva lo escrito', async () => {
      useSession();
      server.use(http.put(`${PROFILE}/password`, () => HttpResponse.json(apiErrorBody(400, 'INVALID_ARGUMENT', 'La contraseña actual no es correcta.'), { status: 400 })));
      await renderPage();
      await fill('mala', 'nueva456', 'nueva456');
      expect(await screen.findByText('La contraseña actual no es correcta.')).toBeInTheDocument();
      expect(screen.getByLabelText('Contraseña nueva')).toHaveValue('nueva456');
    });
  });

  describe('foto', () => {
    it('sin foto ofrece "Subir foto" y no ofrece quitarla', async () => {
      useSession();
      await renderPage();
      expect(screen.getByRole('button', { name: 'Subir foto' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Quitar/ })).not.toBeInTheDocument();
    });

    it('con foto ofrece "Cambiar foto" y "Quitar"', async () => {
      useSession({ avatarVersion: 'v1' });
      await renderPage();
      expect(screen.getByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Quitar/ })).toBeInTheDocument();
    });

    it('sube la foto elegida y guarda la versión nueva en la sesión', async () => {
      useSession();
      // jsdom no sabe enviar un FormData con archivo por su XMLHttpRequest: la API se prueba aparte (profile-api).
      const upload = vi
        .spyOn(ProfileApi.prototype, 'uploadAvatar')
        .mockReturnValue(of({ id: 7, nombre: 'Ana Pérez', email: 'ana@zen.com', rol: 'SELLER', sucursalId: 3, avatarVersion: '2026-10-02T09:00:00' }));
      await renderPage();
      const file = png('yo.png');
      await userEvent.upload(fileInput(), file);
      await vi.waitFor(() => expect(TestBed.inject(AuthStore).session()?.avatarVersion).toBe('2026-10-02T09:00:00'));
      expect(upload).toHaveBeenCalledWith(file);
      expect(await screen.findByRole('button', { name: 'Cambiar foto' })).toBeInTheDocument();
    });

    it('un archivo que no es imagen JPG/PNG/GIF se rechaza sin llamar al servidor', async () => {
      useSession();
      const upload = vi.spyOn(ProfileApi.prototype, 'uploadAvatar');
      await renderPage();
      // `applyAccept: false`: el navegador real filtraría por `accept`, pero un archivo arrastrado o forzado igual llega.
      await userEvent.setup({ applyAccept: false }).upload(fileInput(), new File(['x'], 'nota.pdf', { type: 'application/pdf' }));
      expect(await screen.findByText('Elige una imagen JPG, PNG o GIF.')).toBeInTheDocument();
      expect(upload).not.toHaveBeenCalled();
    });

    it('una imagen de más de 5 MB se rechaza sin llamar al servidor', async () => {
      useSession();
      const upload = vi.spyOn(ProfileApi.prototype, 'uploadAvatar');
      await renderPage();
      await userEvent.upload(fileInput(), png('grande.png', 'image/png', 5 * 1024 * 1024 + 1));
      expect(await screen.findByText('La imagen pesa más de 5 MB. Elige una más liviana.')).toBeInTheDocument();
      expect(upload).not.toHaveBeenCalled();
    });

    it('si el servidor rechaza la imagen muestra su mensaje y no cambia la sesión', async () => {
      useSession();
      vi.spyOn(ProfileApi.prototype, 'uploadAvatar').mockReturnValue(
        throwError(() => new ApiError(400, 'INVALID_ARGUMENT', 'El archivo no es una imagen válida. Usa una foto JPG, PNG o GIF.')),
      );
      await renderPage();
      await userEvent.upload(fileInput(), png());
      expect(await screen.findByText(/no es una imagen válida/)).toBeInTheDocument();
      expect(TestBed.inject(AuthStore).session()?.avatarVersion).toBeUndefined();
    });

    it('quitar la foto limpia la versión de la sesión', async () => {
      useSession({ avatarVersion: 'v1' });
      server.use(http.delete(`${PROFILE}/avatar`, () => HttpResponse.json(USER)));
      await renderPage();
      await userEvent.click(screen.getByRole('button', { name: /Quitar/ }));
      await vi.waitFor(() => expect(TestBed.inject(AuthStore).session()?.avatarVersion).toBeUndefined());
      expect(await screen.findByRole('button', { name: 'Subir foto' })).toBeInTheDocument();
    });
  });
});
