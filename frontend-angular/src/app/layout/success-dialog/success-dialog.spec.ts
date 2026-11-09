import { TestBed } from '@angular/core/testing';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { NotificationService } from '@core/notifications/notification.service';
import { expectAccessible } from '@testing/a11y';
import { SuccessDialog } from './success-dialog';

describe('SuccessDialog', () => {
  it('no muestra nada sin confirmación', async () => {
    await render(SuccessDialog);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('muestra el título y el detalle de la confirmación, y no tiene problemas de accesibilidad detectables', async () => {
    const { container, fixture } = await render(SuccessDialog);
    TestBed.inject(NotificationService).confirm({
      title: 'Orden #12 creada',
      summary: 'La orden de compra se registró correctamente.',
      detail: 'Espera la aprobación de un gerente.',
    });
    fixture.detectChanges();
    const dialog = await screen.findByRole('dialog', { name: 'Orden #12 creada' });
    expect(within(dialog).getByText('La orden de compra se registró correctamente.')).toBeInTheDocument();
    expect(within(dialog).getByText('Espera la aprobación de un gerente.')).toBeInTheDocument();
    expect(within(dialog).queryByText(/Se completó/)).not.toBeInTheDocument(); // nada genérico
    await expectAccessible(container);
  });

  it('«Entendido» la cierra y la quita del servicio', async () => {
    const { fixture } = await render(SuccessDialog);
    const service = TestBed.inject(NotificationService);
    service.confirm({ title: 'Traslado #5 aprobado', summary: 'El traslado se aprobó correctamente.' });
    fixture.detectChanges();
    const dialog = await screen.findByRole('dialog', { name: 'Traslado #5 aprobado' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Entendido' }));
    expect(service.confirmation()).toBeNull();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('la X también la cierra', async () => {
    const { fixture } = await render(SuccessDialog);
    const service = TestBed.inject(NotificationService);
    service.confirm({ title: 'Venta #1 anulada', summary: 'La venta se anuló correctamente.' });
    fixture.detectChanges();
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Cerrar' }));
    await vi.waitFor(() => expect(service.confirmation()).toBeNull());
  });
});
