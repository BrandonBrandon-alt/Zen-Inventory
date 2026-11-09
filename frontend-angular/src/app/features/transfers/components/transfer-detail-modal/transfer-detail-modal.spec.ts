import { provideHttpClient } from '@angular/common/http';
import { inputBinding, signal, twoWayBinding } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import { http, HttpResponse } from 'msw';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { server, TEST_API } from '@testing/msw-server';
import type { Transfer } from '../../data-access/transfers-api';
import { TransferDetailModal } from './transfer-detail-modal';

const preparing: Transfer = {
  id: 3,
  status: 'PREPARING',
  priority: 'NORMAL',
  originBranchId: 10,
  destinationBranchId: 20,
  requestDate: new Date(2026, 9, 13, 8),
  estimatedArrival: null,
  actualArrival: null,
  dispatchDate: null,
  carrier: '',
  trackingNumber: '',
  shippingCost: null,
  freightPaid: 0,
  freightBalance: 0,
  freightStatus: 'SIN_COSTO',
  payments: [],
  receiptNotes: '',
  resolutionReason: '',
  parentId: null,
  requester: '',
  authorizer: '',
  dispatcher: '',
  receiver: '',
  resolver: '',
  lines: [{ id: 31, productId: 100, productName: 'Tornillo', requested: 6, sent: null, received: null, missing: 0 }],
};

/** El traslado llega como señal: cambiarla simula que la lista de fondo se recargó. */
async function renderModal(initial: Transfer) {
  const transfer = signal<Transfer | null>(initial);
  await render(TransferDetailModal, {
    bindings: [
      twoWayBinding('open', signal(true)),
      inputBinding('transfer', transfer),
      inputBinding('actor', signal({ role: 'ADMIN' as const, branchId: null })),
      inputBinding('branchNames', signal(new Map([[10, 'Sede Central'], [20, 'Sucursal Norte']]))),
    ],
    providers: [provideHttpClient(), { provide: API_BASE_URL, useValue: TEST_API }],
  });
  return transfer;
}

describe('TransferDetailModal', () => {
  it('recargar la lista de fondo (mismo traslado, mismo estado) no cierra el formulario que se está llenando', async () => {
    const transfer = await renderModal(preparing);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));
    await userEvent.type(within(dialog).getByLabelText('Transportista'), 'Servi');

    transfer.set({ ...preparing, lines: [...preparing.lines] }); // objeto nuevo, mismo traslado
    await new Promise((resolve) => setTimeout(resolve, 30));

    expect(within(dialog).getByLabelText('Transportista')).toHaveValue('Servi');
  });

  it('si el traslado avanza de estado, el formulario vuelve a la vista de detalle', async () => {
    const transfer = await renderModal(preparing);
    const dialog = screen.getByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Despachar' }));

    transfer.set({ ...preparing, status: 'IN_TRANSIT', lines: [{ ...preparing.lines[0], sent: 6 }] });

    await vi.waitFor(() => expect(within(dialog).queryByLabelText('Transportista')).not.toBeInTheDocument());
  });

  describe('flete al transportista', () => {
    const inTransit: Transfer = {
      ...preparing,
      status: 'IN_TRANSIT',
      dispatchDate: new Date(2026, 9, 14, 9),
      carrier: 'Servientrega',
      shippingCost: 90000,
      freightPaid: 30000,
      freightBalance: 60000,
      freightStatus: 'PAGO_PARCIAL',
      payments: [{ id: 1, amount: 30000, date: new Date(2026, 9, 15, 10), userName: 'Gerente Central', method: 'TRANSFERENCIA', reference: 'TR-7', notes: '' }],
      lines: [{ ...preparing.lines[0], sent: 6 }],
    };

    it('muestra el costo, lo pagado, el saldo y el historial de pagos', async () => {
      await renderModal(inTransit);
      const dialog = screen.getByRole('dialog');
      const section = within(dialog).getByRole('region', { name: 'Flete al transportista' });
      expect(section).toHaveTextContent('$ 90.000');
      expect(section).toHaveTextContent('$ 30.000');
      expect(section).toHaveTextContent('$ 60.000');
      expect(section).toHaveTextContent('Flete con abono');
      expect(within(section).getByText('Gerente Central')).toBeInTheDocument();
      expect(within(section).getByText('TR-7')).toBeInTheDocument();
    });

    it('un traslado sin costo de envío no muestra la sección de flete', async () => {
      await renderModal({ ...inTransit, shippingCost: 0, freightPaid: 0, freightBalance: 0, freightStatus: 'SIN_COSTO', payments: [] });
      expect(screen.queryByRole('region', { name: 'Flete al transportista' })).not.toBeInTheDocument();
    });

    it('registrar un pago ofrece el saldo, envía monto, método y referencia, y no deja pasar del saldo', async () => {
      let body: Record<string, unknown> | null = null;
      server.use(
        http.post(`${TEST_API}/api/v1/transfers/3/pay-freight`, async ({ request }) => {
          body = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({ id: 3, status: 'IN_TRANSIT', originBranchId: 10, destinationBranchId: 20, priority: 'NORMAL', details: [], freightStatus: 'PAGADO', freightBalance: 0, freightPaid: 90000, shippingCost: 90000 });
        }),
      );
      await renderModal(inTransit);
      const dialog = screen.getByRole('dialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago del flete' }));
      const amount = within(dialog).getByLabelText('Monto');
      expect(amount).toHaveValue(60000);
      await userEvent.clear(amount);
      await userEvent.type(amount, '99999');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
      expect(await within(dialog).findByText('Es más de lo que se debe.')).toBeInTheDocument();
      expect(body).toBeNull();
      await userEvent.clear(amount);
      await userEvent.type(amount, '60000');
      await userEvent.type(within(dialog).getByLabelText(/Referencia/), 'TR-8');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Registrar pago' }));
      await vi.waitFor(() => expect(body).toEqual({ amount: 60000, method: 'TRANSFERENCIA', reference: 'TR-8' }));
    });

    it('sin saldo no ofrece pagar', async () => {
      await renderModal({ ...inTransit, freightPaid: 90000, freightBalance: 0, freightStatus: 'PAGADO' });
      expect(within(screen.getByRole('dialog')).queryByRole('button', { name: 'Registrar pago del flete' })).not.toBeInTheDocument();
    });
  });
});
