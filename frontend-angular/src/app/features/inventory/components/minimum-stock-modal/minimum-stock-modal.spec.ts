import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { NotificationService } from '@core/notifications/notification.service';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import type { InventoryItem } from '../../data-access/inventory-api';
import { MinimumStockModal } from './minimum-stock-modal';

const PRODUCT: InventoryItem = { productId: 7, sku: 'T-1', nombre: 'Tornillo', unit: 'UND', stock: 12, minimum: 5, price: 5, cost: 2 };
const CONFIG = `${TEST_API}/api/v1/inventory/branches/3/products/7/config`;

interface Props {
  open: boolean;
  product: InventoryItem | null;
  onSaved: ReturnType<typeof vi.fn>;
}

async function setup(props: Partial<Props> = {}) {
  const componentProperties: Props = { open: true, product: PRODUCT, onSaved: vi.fn(), ...props };
  const result = await render(`<app-minimum-stock-modal [(open)]="open" [product]="product" [branchId]="3" (saved)="onSaved()" />`, {
    imports: [MinimumStockModal],
    componentProperties,
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }],
  });
  const host = result.fixture.componentInstance as unknown as Props;
  const update = async (changes: Partial<Props>) => {
    Object.assign(host, changes);
    result.fixture.detectChanges();
    await result.fixture.whenStable();
  };
  return { host, update };
}

const minimum = () => screen.getByRole('spinbutton', { name: 'Stock mínimo' });
const save = () => screen.getByRole('button', { name: 'Guardar' });

describe('MinimumStockModal', () => {
  afterEach(() => {
    document.body.style.overflow = '';
  });

  it('abre con el mínimo actual del producto', async () => {
    await setup();
    expect(screen.getByRole('dialog', { name: 'Stock mínimo' })).toBeInTheDocument();
    expect(minimum()).toHaveValue(5);
  });

  it('guarda el nuevo mínimo, avisa y cierra', async () => {
    let query = '';
    server.use(http.put(CONFIG, ({ request }) => { query = new URL(request.url).search; return HttpResponse.json({}); }));
    const { host } = await setup();
    await userEvent.clear(minimum());
    await userEvent.type(minimum(), '12');
    await userEvent.click(save());
    await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
    expect(query).toBe('?minimumStock=12');
    expect(host.open).toBe(false);
    expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Stock mínimo actualizado correctamente.' });
  });

  it('cero es válido (desactiva las alertas del producto); vacío o negativo no', async () => {
    server.use(http.put(CONFIG, () => HttpResponse.json({})));
    const { host } = await setup();
    await userEvent.clear(minimum());
    await userEvent.click(save());
    expect(screen.getByText('El stock mínimo es requerido.')).toBeInTheDocument();
    await userEvent.type(minimum(), '-1');
    await userEvent.click(save());
    expect(screen.getByText('El stock mínimo no puede ser negativo.')).toBeInTheDocument();
    expect(host.onSaved).not.toHaveBeenCalled();
    await userEvent.clear(minimum());
    await userEvent.type(minimum(), '0');
    await userEvent.click(save());
    await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
  });

  it('un error del servidor se muestra en el formulario sin cerrarlo ni lanzar un aviso global', async () => {
    server.use(http.put(CONFIG, () => HttpResponse.json(apiErrorBody(403, 'FORBIDDEN_ACTION', 'No tiene acceso a esa sucursal.'), { status: 403 })));
    const { host } = await setup();
    await userEvent.click(save());
    expect(await screen.findByRole('alert')).toHaveTextContent('No tiene acceso a esa sucursal.');
    expect(host.open).toBe(true);
    expect(TestBed.inject(NotificationService).items()).toEqual([]);
  });

  it('al abrirlo para otro producto parte de su mínimo', async () => {
    const { update } = await setup({ open: false });
    await update({ open: true, product: { ...PRODUCT, productId: 8, minimum: 20 } });
    expect(minimum()).toHaveValue(20);
  });
});
