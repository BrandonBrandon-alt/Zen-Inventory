import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { LoginEventsPanel } from './login-events-panel';

const URL_L = `${TEST_API}/api/v1/audit/logins`;
const EVENTS = [
  { id: 3, date: '2026-11-08T21:05:00', email: 'nadie@x.co', userId: null, userName: null, outcome: 'CREDENCIALES_INVALIDAS', ip: '181.50.1.2' },
  { id: 2, date: '2026-11-08T21:00:00', email: 'ana@x.co', userId: 7, userName: 'Ana Ruiz', outcome: 'EXITOSO', ip: '10.0.0.5' },
  { id: 1, date: '2026-11-08T20:00:00', email: 'luis@x.co', userId: 8, userName: 'Luis Pérez', outcome: 'BLOQUEADO', ip: null },
];

let requests: URLSearchParams[] = [];
const last = () => requests.at(-1)!;

function stub(content: unknown[] = EVENTS, totalElements = content.length, failures = 2) {
  server.use(
    http.get(URL_L, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ content, totalElements, page: 0, size: 15, totalPages: 1, failures });
    }),
  );
}

const renderPanel = () =>
  render(LoginEventsPanel, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

describe('LoginEventsPanel', () => {
  beforeEach(() => {
    requests = [];
  });

  it('muestra cada intento con la persona (o «Sin cuenta»), el resultado y la IP, y el resumen de fallidos', async () => {
    stub(EVENTS, 40, 12);
    await renderPanel();
    const unknown = await screen.findByRole('row', { name: /nadie@x\.co/ });
    expect(within(unknown).getByText('Sin cuenta')).toBeInTheDocument();
    expect(within(unknown).getByText('Credenciales inválidas')).toBeInTheDocument();
    expect(within(unknown).getByText('181.50.1.2')).toBeInTheDocument();
    expect(within(screen.getByRole('row', { name: /ana@x\.co/ })).getByText('Exitoso')).toBeInTheDocument();
    const blocked = screen.getByRole('row', { name: /luis@x\.co/ });
    expect(within(blocked).getByText('Bloqueado por intentos')).toBeInTheDocument();
    expect(within(blocked).getByText('—')).toBeInTheDocument(); // sin IP
    expect(screen.getByText('40 intentos, 12 fallidos')).toBeInTheDocument();
    expect(last().get('page')).toBe('0');
    expect(last().get('size')).toBe('15');
  });

  it('no tiene problemas de accesibilidad detectables', async () => {
    stub();
    await renderPanel();
    await screen.findByRole('row', { name: /ana@x\.co/ });
    await expectAccessible();
  });

  it('los filtros se mandan al servidor y la búsqueda una sola vez, al dejar de escribir', async () => {
    stub();
    await renderPanel();
    await screen.findByRole('row', { name: /ana@x\.co/ });
    await chooseOption('Resultado', 'Bloqueado por intentos');
    await vi.waitFor(() => expect(last().get('outcome')).toBe('BLOQUEADO'));
    const before = requests.length;
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar inicio de sesión' }), ' luis ');
    await vi.waitFor(() => expect(last().get('q')).toBe('luis'));
    expect(requests.length).toBe(before + 1);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await vi.waitFor(() => expect(last().has('outcome')).toBe(false));
    expect(last().has('q')).toBe(false);
  });

  it('sin intentos lo explica, y con filtros dice que ninguno coincide', async () => {
    stub([]);
    await renderPanel();
    expect(await screen.findByText('Todavía no hay inicios de sesión registrados')).toBeInTheDocument();
    await chooseOption('Resultado', 'Exitoso');
    expect(await screen.findByText('Ningún inicio de sesión coincide')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error en la tabla', async () => {
    server.use(http.get(URL_L, () => HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'Solo el administrador'), { status: 403 })));
    await renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el administrador');
  });
});
