import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen } from '@testing-library/angular';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { authInterceptor } from '@core/auth/http/auth.interceptor';
import { AuthStore } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { routes } from '../../app/app.routes';
import { apiErrorBody, server, TEST_API } from '../msw-server';

const sessionFor = (rol: string) => ({ token: 't', email: 'e@z.com', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

async function setup(rol?: string) {
  localStorage.clear();
  server.use(http.get(`${TEST_API}/api/branches/3`, () => HttpResponse.json({ id: 3, nombre: 'Norte' })));
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(withInterceptors([errorInterceptor, authInterceptor])),
      { provide: API_BASE_URL, useValue: TEST_API },
    ],
  });
  if (rol) TestBed.inject(AuthStore).start(sessionFor(rol));
  const harness = await RouterTestingHarness.create();
  return { harness, router: TestBed.inject(Router), store: TestBed.inject(AuthStore) };
}

describe('rutas (guardas + shell + login)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('sin sesión, una ruta protegida lleva al login', async () => {
    const { harness, router } = await setup();
    await harness.navigateByUrl('/inventory');
    expect(router.url).toBe('/login');
    expect(await screen.findByRole('heading', { name: 'Bienvenido de vuelta' })).toBeInTheDocument();
  });

  it('con sesión, "/" lleva al panel dentro del shell', async () => {
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/');
    expect(router.url).toBe('/dashboard');
    expect(await screen.findByRole('navigation', { name: 'Principal' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /^Buen(os|as) (días|tardes|noches)/ })).toBeInTheDocument();
  });

  it('el enlace de la pantalla actual queda marcado como página actual', async () => {
    const { harness } = await setup('ADMIN');
    await harness.navigateByUrl('/inventory');
    const active = await screen.findByRole('link', { name: 'Inventario' });
    expect(active).toHaveAttribute('aria-current', 'page');
    // La pantalla actual se resalta con el color de marca; las demás no.
    expect(active).toHaveClass('text-brand!');
    expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveClass('text-brand!');
  });

  it('con sesión, entrar al login redirige al panel', async () => {
    const { harness, router } = await setup('MANAGER');
    await harness.navigateByUrl('/login');
    expect(router.url).toBe('/dashboard');
  });

  it('un rol sin permiso para una ruta vuelve al panel', async () => {
    const { harness, router } = await setup('OPERADOR_INVENTARIO');
    await harness.navigateByUrl('/users');
    expect(router.url).toBe('/dashboard');
  });

  it('un ADMIN accede a un maestro', async () => {
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/catalog/products');
    expect(router.url).toBe('/catalog/products');
    expect(await screen.findByRole('heading', { name: 'Productos' })).toBeInTheDocument();
  });

  it('un rol desconocido cierra la sesión y termina en el login sin bucle', async () => {
    const { harness, router, store } = await setup('INVENTADO');
    await harness.navigateByUrl('/dashboard');
    expect(router.url).toBe('/login');
    expect(store.isAuthenticated()).toBe(false);
  });

  it('una ruta inexistente con sesión lleva al panel', async () => {
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/no-existe');
    expect(router.url).toBe('/dashboard');
  });

  it('el sidebar muestra la sucursal del usuario obtenida del backend', async () => {
    const { harness } = await setup('MANAGER');
    await harness.navigateByUrl('/dashboard');
    expect(await screen.findByText('Norte')).toBeInTheDocument();
  });

  it('token vencido en una llamada autenticada: cierra la sesión, lleva al login y avisa al usuario', async () => {
    const { harness, router, store } = await setup('MANAGER');
    server.use(
      http.get(`${TEST_API}/api/branches/3`, () =>
        HttpResponse.json(apiErrorBody(401, 'TOKEN_EXPIRED', 'Tu sesión expiró. Inicia sesión de nuevo.'), { status: 401 }),
      ),
    );
    await harness.navigateByUrl('/dashboard');

    await vi.waitFor(() => expect(router.url).toBe('/login'));
    expect(store.isAuthenticated()).toBe(false);
    expect(TestBed.inject(NotificationService).items()).toEqual([
      expect.objectContaining({ kind: 'warning', message: 'Tu sesión expiró. Inicia sesión de nuevo.' }),
    ]);
  });

  it('falta de permisos (403) en una llamada: avisa pero NO cierra la sesión', async () => {
    const { harness, router, store } = await setup('MANAGER');
    server.use(
      http.get(`${TEST_API}/api/branches/3`, () =>
        HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'No tienes permisos para realizar esta acción.'), { status: 403 }),
      ),
    );
    await harness.navigateByUrl('/dashboard');

    await vi.waitFor(() => expect(TestBed.inject(NotificationService).items()).toHaveLength(1));
    expect(router.url).toBe('/dashboard');
    expect(store.isAuthenticated()).toBe(true);
  });

  it('servidor caído en una llamada: avisa del error sin cerrar la sesión y el sidebar sigue mostrando el nombre', async () => {
    const { harness, store } = await setup('MANAGER');
    server.use(http.get(`${TEST_API}/api/branches/3`, () => HttpResponse.error()));
    await harness.navigateByUrl('/dashboard');

    await vi.waitFor(() => expect(TestBed.inject(NotificationService).items()).toHaveLength(1));
    expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'error' });
    expect(store.isAuthenticated()).toBe(true);
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('Sucursales ya está migrada: muestra la tabla con los datos del backend', async () => {
    server.use(
      http.get(`${TEST_API}/api/branches`, () =>
        HttpResponse.json([{ id: 3, nombre: 'Sucursal Norte', direccion: 'Av. 15', telefono: '601', activa: true }]),
      ),
    );
    const { harness, router } = await setup('ADMIN');
    await harness.navigateByUrl('/branches');
    expect(router.url).toBe('/branches');
    expect(await screen.findByRole('table', { name: 'Listado de sucursales' })).toBeInTheDocument();
    expect(await screen.findByText('Av. 15')).toBeInTheDocument();
  });

  it('Usuarios ya está migrada y un MANAGER entra (el backend le limita el alcance)', async () => {
    server.use(
      http.get(`${TEST_API}/api/users`, () => HttpResponse.json([])),
      http.get(`${TEST_API}/api/roles`, () => HttpResponse.json([])),
      http.get(`${TEST_API}/api/branches`, () => HttpResponse.json([])),
    );
    const { harness, router } = await setup('MANAGER');
    await harness.navigateByUrl('/users');
    expect(router.url).toBe('/users');
    expect(await screen.findByText('Todavía no hay usuarios')).toBeInTheDocument();
  });

  it('Inventario ya está migrado y cualquier rol con sucursal entra', async () => {
    server.use(
      http.get(`${TEST_API}/api/catalog/products`, () => HttpResponse.json([{ id: 1, sku: 'A', nombre: 'Tornillo', unitAbbreviation: 'UND', activo: true }])),
      http.get(`${TEST_API}/api/v1/inventory/branches/3`, () => HttpResponse.json([{ productId: 1, stockActual: 4, stockMinimo: 2 }])),
    );
    const { harness, router } = await setup('SELLER');
    await harness.navigateByUrl('/inventory');
    expect(router.url).toBe('/inventory');
    expect(await screen.findByText('Tornillo')).toBeInTheDocument();
  });

  it('un SELLER no entra a Usuarios: vuelve al panel', async () => {
    const { harness, router } = await setup('SELLER');
    await harness.navigateByUrl('/users');
    expect(router.url).toBe('/dashboard');
  });

  it('un MANAGER no entra a Sucursales: vuelve al panel', async () => {
    const { harness, router } = await setup('MANAGER');
    await harness.navigateByUrl('/branches');
    expect(router.url).toBe('/dashboard');
  });
});
