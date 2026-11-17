import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import { expectAccessible } from '@testing/a11y';
import { CatalogChangesPanel } from './catalog-changes-panel';

const URL_C = `${TEST_API}/api/v1/audit/catalog-changes`;
const CHANGES = [
  { id: 3, date: '2026-11-08T21:05:00', entity: 'PRODUCTO', entityId: 1, entityName: 'Cemento Gris 50Kg', field: 'Precio de venta', before: '$ 34.000', after: '$ 36.000', userName: 'Ana Ruiz' },
  { id: 2, date: '2026-11-08T21:00:00', entity: 'USUARIO', entityId: 7, entityName: 'Luis Pérez', field: 'Rol', before: 'Vendedor', after: 'Gerente', userName: 'Admin General' },
  { id: 1, date: '2026-11-08T20:00:00', entity: 'USUARIO', entityId: 8, entityName: 'Marta Gil', field: 'Cuenta', before: '—', after: 'Creada · Vendedor', userName: null },
];

let requests: URLSearchParams[] = [];
const last = () => requests.at(-1)!;

function stub(content: unknown[] = CHANGES, totalElements = content.length) {
  server.use(
    http.get(URL_C, ({ request }) => {
      requests.push(new URL(request.url).searchParams);
      return HttpResponse.json({ content, totalElements, page: 0, size: 15, totalPages: 1 });
    }),
  );
}

const renderPanel = () =>
  render(CatalogChangesPanel, { providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }] });

describe('CatalogChangesPanel', () => {
  beforeEach(() => {
    requests = [];
  });
  afterEach(() => vi.useRealTimers());

  it('muestra Qué · Campo · Antes → Después · Quién, y el total', async () => {
    stub(CHANGES, 40);
    await renderPanel();
    const price = await screen.findByRole('row', { name: /Cemento Gris 50Kg/ });
    expect(price).toHaveTextContent('Producto «Cemento Gris 50Kg»');
    expect(within(price).getByText('Precio de venta')).toBeInTheDocument();
    expect(price).toHaveTextContent('$ 34.000 → $ 36.000');
    expect(within(price).getByText('Ana Ruiz')).toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Luis Pérez/ })).toHaveTextContent('Usuario «Luis Pérez»');
    expect(within(screen.getByRole('row', { name: /Marta Gil/ })).getByText('Sistema')).toBeInTheDocument(); // sin quién
    expect(screen.getByText('40 cambios')).toBeInTheDocument();
    expect(last().get('page')).toBe('0');
    expect(last().get('size')).toBe('15');
  });

  it('no tiene problemas de accesibilidad detectables', async () => {
    stub();
    await renderPanel();
    await screen.findByRole('row', { name: /Cemento/ });
    await expectAccessible();
  });

  it('los filtros se mandan al servidor y la búsqueda una sola vez, al dejar de escribir', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 10, 10, 10, 0));
    stub();
    await renderPanel();
    await screen.findByRole('row', { name: /Cemento/ });
    await chooseOption('Qué cambió', 'Usuarios');
    await vi.waitFor(() => expect(last().get('entity')).toBe('USUARIO'));
    await userEvent.click(screen.getByRole('button', { name: 'Desde' }));
    await userEvent.click(screen.getByRole('button', { name: /\b3 de noviembre de 2026/ }));
    await vi.waitFor(() => expect(last().get('from')).toBe('2026-11-03'));
    const before = requests.length;
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar cambio' }), ' precio ');
    await vi.waitFor(() => expect(last().get('q')).toBe('precio'));
    expect(requests.length).toBe(before + 1);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar filtros' }));
    await vi.waitFor(() => expect(last().has('entity')).toBe(false));
    expect(last().has('q')).toBe(false);
    expect(last().has('from')).toBe(false);
  });

  it('sin cambios lo explica, y con filtros dice que ninguno coincide', async () => {
    stub([]);
    await renderPanel();
    expect(await screen.findByText('Todavía no hay cambios registrados')).toBeInTheDocument();
    await chooseOption('Qué cambió', 'Productos');
    expect(await screen.findByText('Ningún cambio coincide')).toBeInTheDocument();
  });

  it('si falla la carga muestra el error en la tabla', async () => {
    server.use(http.get(URL_C, () => HttpResponse.json(apiErrorBody(403, 'ACCESS_DENIED', 'Solo el administrador'), { status: 403 })));
    await renderPanel();
    expect(await screen.findByRole('alert')).toHaveTextContent('Solo el administrador');
  });
});
