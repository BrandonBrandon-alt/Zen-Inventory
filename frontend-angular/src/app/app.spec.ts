
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import { NotificationService } from './core/notifications/notification.service';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [App] }).compileComponents();
  });

  it('se crea', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('delega el contenido al router', async () => {
     const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const root = fixture.nativeElement as HTMLElement;
    expect(root.querySelector('router-outlet')).not.toBeNull();
  });

  it('muestra los avisos globales (también fuera del shell, p. ej. en el login)', async () => {
    await render(App, { providers: [provideRouter([])] });
    TestBed.inject(NotificationService).warning('Tu sesión expiró. Inicia sesión de nuevo.');
    expect(await screen.findByText('Tu sesión expiró. Inicia sesión de nuevo.')).toBeInTheDocument();
  });

  it('confirma las acciones importantes en un modal, que se carga recién cuando hace falta', async () => {
    await render(App, { providers: [provideRouter([])] });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    TestBed.inject(NotificationService).confirm({ title: 'Orden #12 creada', summary: 'La orden de compra se registró correctamente.', detail: 'Espera la aprobación de un gerente.' });
    expect(await screen.findByRole('dialog', { name: 'Orden #12 creada' })).toBeInTheDocument();
    expect(screen.getByText('Espera la aprobación de un gerente.')).toBeInTheDocument();
  });
});
