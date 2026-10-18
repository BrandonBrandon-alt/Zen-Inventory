import { TestBed } from '@angular/core/testing';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { NotificationService } from '@core/notifications/notification.service';
import { ToastContainer } from './toast-container';

describe('ToastContainer', () => {
  it('no muestra nada sin avisos', async () => {
    await render(ToastContainer);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('muestra los avisos del servicio, también los que llegan después', async () => {
    await render(ToastContainer);
    TestBed.inject(NotificationService).error('Sin conexión');
    expect(await screen.findByText('Sin conexión')).toBeInTheDocument();
  });

  it('cerrar un aviso lo quita del servicio', async () => {
    await render(ToastContainer);
    const service = TestBed.inject(NotificationService);
    service.error('Sin conexión');
    await userEvent.click(await screen.findByRole('button', { name: 'Cerrar aviso' }));
    expect(service.items()).toEqual([]);
    expect(screen.queryByText('Sin conexión')).not.toBeInTheDocument();
  });
});
