
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
});
