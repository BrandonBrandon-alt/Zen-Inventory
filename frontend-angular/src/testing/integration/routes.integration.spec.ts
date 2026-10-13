import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { screen } from '@testing-library/angular';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { authInterceptor } from '@core/auth/http/auth.interceptor';
import { AuthStore } from '@core/auth/session/auth-store';
import { routes } from '../../app/app.routes';
import { server, TEST_API } from '../msw-server';

const sessionFor = (rol: string) => ({ token: 't', email: 'e@z.com', nombre: 'Ana', rol, id: 1, sucursalId: 3 });

async function setup(rol?: string) {
  localStorage.clear();
  server.use(http.get(`${TEST_API}/api/branches/3`, () => HttpResponse.json({ id: 3, nombre: 'Norte' })));
  TestBed.configureTestingModule({
    providers: [
      provideRouter(routes),
      provideHttpClient(withInterceptors([authInterceptor])),
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
    expect(screen.getByRole('heading', { name: 'Panel' })).toBeInTheDocument();
    expect(screen.getByText(/todavía no está disponible/)).toBeInTheDocument();
  });

  it('el enlace de la pantalla actual queda marcado como página actual', async () => {
    const { harness } = await setup('ADMIN');
    await harness.navigateByUrl('/inventory');
    expect(await screen.findByRole('link', { name: 'Inventario' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Panel' })).not.toHaveAttribute('aria-current');
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
});
