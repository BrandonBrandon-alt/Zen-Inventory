import { provideHttpClient } from '@angular/common/http';
import { inputBinding, signal, twoWayBinding } from '@angular/core';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { API_BASE_URL } from '@core/api/api-base-url';
import { TEST_API } from '@testing/msw-server';
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
});
