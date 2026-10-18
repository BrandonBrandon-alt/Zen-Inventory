import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { delay, http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { errorInterceptor } from '@core/api/error.interceptor';
import { SESSION_STORAGE_KEY } from '@core/auth/session/auth-store';
import { NotificationService } from '@core/notifications/notification.service';
import { chooseOption } from '@testing/select-helpers';
import { apiErrorBody, server, TEST_API } from '@testing/msw-server';
import type { InventoryItem } from '../../data-access/inventory-api';
import { AdjustStockModal } from './adjust-stock-modal';

const PRODUCT: InventoryItem = { productId: 7, sku: 'T-1', nombre: 'Tornillo', unit: 'UND', stock: 12, minimum: 5, price: 5, cost: 2 };
const BASE = `${TEST_API}/api/v1/inventory/branches/3/products/7`;
const LONG_TEXT = 'Conteo físico del lunes en bodega';

const TEMPLATE = `<app-adjust-stock-modal [(open)]="open" [product]="product" [branchId]="3" (saved)="onSaved()" />`;

interface Props {
  open: boolean;
  product: InventoryItem | null;
  onSaved: ReturnType<typeof vi.fn>;
}

const navigateByUrl = vi.fn(async () => true);

async function setup(props: Partial<Props> = {}) {
  const componentProperties: Props = { open: true, product: PRODUCT, onSaved: vi.fn(), ...props };
  const result = await render(TEMPLATE, {
    imports: [AdjustStockModal],
    componentProperties,
    providers: [provideHttpClient(withInterceptors([errorInterceptor])), { provide: API_BASE_URL, useValue: TEST_API }, { provide: Router, useValue: { navigateByUrl } }],
  });
  const host = result.fixture.componentInstance as unknown as Props;
  const update = async (changes: Partial<Props>) => {
    Object.assign(host, changes);
    result.fixture.detectChanges();
    await result.fixture.whenStable();
  };
  return { host, update };
}

const quantity = () => screen.getByLabelText(/Cantidad a/);
const cost = () => screen.queryByLabelText(/Costo unitario/);
const justification = () => screen.getByLabelText(/Justificación|Observaciones/);
const submit = () => screen.getByRole('button', { name: 'Registrar movimiento' });

describe('AdjustStockModal', () => {
  beforeEach(() => {
    navigateByUrl.mockClear();
    localStorage.clear();
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify({ token: 't', email: 'a@z.co', nombre: 'Ana', rol: 'MANAGER', id: 5, sucursalId: 3 }));
  });
  afterEach(() => {
    localStorage.clear();
    document.body.style.overflow = '';
  });

  describe('movimientos que se registran en otra pantalla', () => {
    it('Compra y Traslado aparecen entre los motivos de un ingreso, y Venta y Traslado en un retiro', async () => {
      await setup();
      await userEvent.click(screen.getByRole('combobox', { name: 'Motivo' }));
      expect(screen.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual(
        expect.arrayContaining([expect.stringContaining('Compra a proveedor'), expect.stringContaining('Traslado recibido')]),
      );
      await userEvent.keyboard('{Escape}');
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await userEvent.click(screen.getByRole('combobox', { name: 'Motivo' }));
      expect(screen.getAllByRole('option').map((o) => o.textContent?.trim())).toEqual(
        expect.arrayContaining([expect.stringContaining('Venta a cliente'), expect.stringContaining('Traslado enviado')]),
      );
    });

    it('al elegir Compra explica por qué y lleva a Compras; no se puede registrar el movimiento aquí', async () => {
      let posted = false;
      server.use(http.post(`${TEST_API}/api/v1/inventory/branches/3/products/7/add`, () => ((posted = true), HttpResponse.json({}))));
      const { host } = await setup();
      await chooseOption('Motivo', 'Compra a proveedor');
      const dialog = screen.getByRole('dialog', { name: 'Ajustar stock' });
      expect(within(dialog).getByText(/orden de compra/)).toBeInTheDocument();
      expect(screen.queryByLabelText(/Cantidad a/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Registrar movimiento' })).not.toBeInTheDocument();
      await userEvent.click(within(dialog).getByRole('button', { name: /Ir a Compras/ }));
      expect(navigateByUrl).toHaveBeenCalledWith('/purchases');
      expect(host.open).toBe(false);
      expect(posted).toBe(false);
    });

    it('Traslado lleva a Traslados', async () => {
      await setup();
      await chooseOption('Motivo', 'Traslado recibido');
      await userEvent.click(screen.getByRole('button', { name: /Ir a Traslados/ }));
      expect(navigateByUrl).toHaveBeenLastCalledWith('/transfers');
    });

    it('Venta lleva al punto de venta', async () => {
      await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await chooseOption('Motivo', 'Venta a cliente');
      await userEvent.click(screen.getByRole('button', { name: /Ir al punto de venta/ }));
      expect(navigateByUrl).toHaveBeenLastCalledWith('/sales/pos');
    });

    it('volver a un motivo manual devuelve el formulario', async () => {
      await setup();
      await chooseOption('Motivo', 'Compra a proveedor');
      expect(screen.queryByLabelText(/Cantidad a/)).not.toBeInTheDocument();
      await chooseOption('Motivo', 'Ajuste de auditoría (+)');
      expect(quantity()).toBeInTheDocument();
      expect(submit()).toBeInTheDocument();
    });
  });

  describe('modos y motivos', () => {
    it('abre en "Ingreso" con el motivo de ajuste y muestra el producto y sus existencias', async () => {
      await setup();
      expect(screen.getByRole('dialog', { name: 'Ajustar stock' })).toHaveAccessibleDescription('Tornillo · Existencias: 12 UND');
      expect(screen.getByRole('tab', { name: 'Ingreso' })).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByRole('combobox', { name: 'Motivo' })).toHaveTextContent('Ajuste de auditoría (+)');
    });

    it('en "Retiro" cambia el motivo a merma, ofrece las categorías y deja de ofrecer costo', async () => {
      await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      expect(screen.getByRole('combobox', { name: 'Motivo' })).toHaveTextContent('Merma / daño');
      expect(screen.getByRole('combobox', { name: 'Categoría de la merma' })).toBeInTheDocument();
      expect(cost()).not.toBeInTheDocument();
      expect(screen.getByLabelText('Cantidad a retirar')).toBeInTheDocument();
    });

    it('el costo solo se ofrece en el ajuste (+), no en una devolución de cliente', async () => {
      await setup();
      expect(cost()).toBeInTheDocument();
      await chooseOption('Motivo', 'Devolución de cliente');
      expect(cost()).not.toBeInTheDocument();
    });

    it('la justificación es obligatoria en ajustes y mermas, y opcional en devoluciones', async () => {
      await setup();
      expect(screen.getByLabelText('Justificación')).toBeInTheDocument();
      await chooseOption('Motivo', 'Devolución de cliente');
      expect(screen.getByLabelText('Observaciones (opcional)')).toBeInTheDocument();
    });
  });

  describe('validación', () => {
    it('al enviar vacío muestra qué falta y no llama al backend', async () => {
      let calls = 0;
      server.use(http.post(`${BASE}/add`, () => { calls++; return new HttpResponse(null, { status: 204 }); }));
      await setup();
      await userEvent.click(submit());
      expect(screen.getByText('La cantidad es requerida.')).toBeInTheDocument();
      expect(screen.getByText('Debes justificar el movimiento.')).toBeInTheDocument();
      expect(calls).toBe(0);
    });

    it('la cantidad debe ser mayor a cero', async () => {
      await setup();
      await userEvent.type(quantity(), '0');
      await userEvent.click(submit());
      expect(screen.getByText('La cantidad debe ser mayor a cero.')).toBeInTheDocument();
    });

    it('la justificación de un ajuste necesita al menos 15 caracteres', async () => {
      await setup();
      await userEvent.type(quantity(), '3');
      await userEvent.type(justification(), 'muy corta');
      await userEvent.click(submit());
      expect(screen.getByText('Justifica con al menos 15 caracteres.')).toBeInTheDocument();
    });

    it('una merma exige categoría', async () => {
      await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await userEvent.type(quantity(), '2');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.click(submit());
      expect(screen.getByText('Elige la categoría de la merma.')).toBeInTheDocument();
    });

    it('un costo negativo se rechaza', async () => {
      await setup();
      await userEvent.type(quantity(), '1');
      await userEvent.type(screen.getByLabelText(/Costo unitario/), '-3');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.click(submit());
      expect(screen.getByText('El costo no puede ser negativo.')).toBeInTheDocument();
    });
  });

  describe('vista previa', () => {
    it('muestra en cuánto quedarían las existencias al ingresar y al retirar', async () => {
      await setup();
      await userEvent.type(quantity(), '8');
      expect(screen.getByText('Quedaría en 20 UND')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      expect(screen.getByText('Quedaría en 4 UND')).toBeInTheDocument();
    });

    it('si el retiro supera lo que hay, se avisa (queda negativo)', async () => {
      await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await userEvent.type(quantity(), '20');
      expect(screen.getByText('Quedaría en -8 UND')).toHaveClass('text-danger');
    });
  });

  describe('guardar', () => {
    it('ingreso por ajuste: llama a /add con motivo, justificación y costo; avisa y cierra', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(`${BASE}/add`, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
      const { host } = await setup();
      await userEvent.type(quantity(), '4');
      await userEvent.type(screen.getByLabelText(/Costo unitario/), '2.5');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.click(submit());

      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(body).toEqual({ quantity: 4, reason: 'AJUSTE_POSITIVO', userId: 5, observations: LONG_TEXT, unitCost: 2.5 });
      expect(host.open).toBe(false);
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ kind: 'success', message: 'Ingreso registrado correctamente.' });
    });

    it('retiro por merma: llama a /withdraw con la categoría y sin costo', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(`${BASE}/withdraw`, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
      const { host } = await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await chooseOption('Categoría de la merma', 'Daño físico');
      await userEvent.type(quantity(), '2');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.click(submit());

      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalledTimes(1));
      expect(body).toEqual({ quantity: 2, reason: 'MERMA', userId: 5, observations: LONG_TEXT, subReason: 'DAÑO_FISICO' });
      expect(TestBed.inject(NotificationService).items()[0]).toMatchObject({ message: 'Retiro registrado correctamente.' });
    });

    it('una devolución de cliente se registra sin justificación ni costo', async () => {
      let body: Record<string, unknown> = {};
      server.use(http.post(`${BASE}/add`, async ({ request }) => { body = (await request.json()) as Record<string, unknown>; return new HttpResponse(null, { status: 204 }); }));
      const { host } = await setup();
      await chooseOption('Motivo', 'Devolución de cliente');
      await userEvent.type(quantity(), '1');
      await userEvent.click(submit());
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect(body).toEqual({ quantity: 1, reason: 'DEVOLUCION', userId: 5, observations: '' });
    });

    it('mientras guarda no se puede cerrar y un doble envío hace una sola petición', async () => {
      let calls = 0;
      server.use(http.post(`${BASE}/add`, async () => { calls++; await delay(150); return new HttpResponse(null, { status: 204 }); }));
      const { host } = await setup();
      await userEvent.type(quantity(), '1');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.dblClick(submit());
      expect(screen.queryByRole('button', { name: 'Cerrar' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled();
      await vi.waitFor(() => expect(host.onSaved).toHaveBeenCalled());
      expect(calls).toBe(1);
    });
  });

  describe('errores del servidor', () => {
    it('sin stock suficiente: el motivo queda en el formulario, se conserva lo escrito y no hay aviso global', async () => {
      server.use(http.post(`${BASE}/withdraw`, () => HttpResponse.json(apiErrorBody(422, 'INSUFFICIENT_STOCK', 'Stock insuficiente para Tornillo'), { status: 422 })));
      const { host } = await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await chooseOption('Categoría de la merma', 'Robo');
      await userEvent.type(quantity(), '50');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.click(submit());

      expect(await screen.findByRole('alert')).toHaveTextContent('Stock insuficiente para Tornillo');
      expect(quantity()).toHaveValue(50);
      expect(host.open).toBe(true);
      expect(host.onSaved).not.toHaveBeenCalled();
      expect(TestBed.inject(NotificationService).items()).toEqual([]);
    });

    it('un error por campo se muestra bajo ese campo', async () => {
      server.use(
        http.post(`${BASE}/add`, () =>
          HttpResponse.json(apiErrorBody(400, 'VALIDATION_FAILED', 'quantity: no válida', { fieldErrors: [{ field: 'quantity', message: 'Cantidad fuera de rango' }] }), { status: 400 }),
        ),
      );
      await setup();
      await userEvent.type(quantity(), '3');
      await userEvent.type(justification(), LONG_TEXT);
      await userEvent.click(submit());
      expect(await screen.findByText('Cantidad fuera de rango')).toBeInTheDocument();
      expect(screen.getAllByRole('alert')).toHaveLength(1);
    });
  });

  describe('reapertura', () => {
    it('vuelve a abrir limpio y en "Ingreso", sin lo escrito ni errores', async () => {
      const { update } = await setup();
      await userEvent.click(screen.getByRole('tab', { name: 'Retiro' }));
      await userEvent.type(quantity(), '9');
      await userEvent.click(submit());
      await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
      await update({ open: true });
      expect(screen.getByRole('tab', { name: 'Ingreso' })).toHaveAttribute('aria-selected', 'true');
      expect(quantity()).toHaveValue(null);
      expect(screen.queryByText('Justifica con al menos 15 caracteres.')).not.toBeInTheDocument();
    });
  });
});
